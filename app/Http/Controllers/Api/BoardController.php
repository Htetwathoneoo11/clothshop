<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Board;
use App\Support\AdminAudit;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class BoardController extends Controller
{
    public function active(Request $request)
    {
        $board = Board::query()
            ->where('is_active', true)
            ->where(function ($query) {
                $query->whereNull('starts_at')
                    ->orWhere('starts_at', '<=', now());
            })
            ->where(function ($query) {
                $query->whereNull('ends_at')
                    ->orWhere('ends_at', '>=', now());
            })
            ->orderByDesc('priority')
            ->orderByDesc('id')
            ->first();

        $payload = $board?->toApiArray();

        return response()->json([
            'board' => $payload,
            // Backward-compatible alias for old clients.
            'banner' => $payload,
        ]);
    }

    public function index(Request $request)
    {
        $search = trim((string) $request->query('q', ''));
        $status = trim((string) $request->query('status', 'all'));
        $sort = trim((string) $request->query('sort', 'newest'));
        $perPage = max(1, min(30, (int) $request->query('per_page', 8)));

        $boards = Board::query()
            ->when($search !== '', function (Builder $query) use ($search) {
                $query->where(function (Builder $subQuery) use ($search) {
                    $subQuery->where('title', 'like', '%'.$search.'%')
                        ->orWhere('subtitle', 'like', '%'.$search.'%')
                        ->orWhere('cta_text', 'like', '%'.$search.'%')
                        ->orWhere('cta_link', 'like', '%'.$search.'%');
                });
            })
            ->when($status === 'active', fn (Builder $query) => $query->where('is_active', true))
            ->when($status === 'inactive', fn (Builder $query) => $query->where('is_active', false));

        $this->applyIndexSort($boards, $sort);

        $paginated = $boards->paginate($perPage)->withQueryString();
        $payload = collect($paginated->items())
            ->map(fn (Board $board) => $board->toApiArray())
            ->values()
            ->all();

        return response()->json([
            'boards' => $payload,
            // Backward-compatible alias for old clients.
            'banners' => $payload,
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                'global_total' => Board::query()->count(),
            ],
            'filters' => [
                'q' => $search,
                'status' => $status,
                'sort' => $sort,
            ],
        ]);
    }

    public function store(Request $request)
    {
        if (Board::query()->count() >= 5) {
            return response()->json([
                'message' => 'Maximum 5 boards allowed.',
            ], 422);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string'],
            'image' => ['nullable', 'image', 'max:5120'],
            'cta_text' => ['nullable', 'string', 'max:120'],
            'cta_link' => ['nullable', 'url', 'max:2048'],
            'is_active' => ['nullable', 'boolean'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'priority' => ['nullable', 'integer', 'min:0'],
        ]);

        $imagePath = null;
        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $extension = $file->guessExtension() ?: 'jpg';
            $imagePath = $file->storeAs('hero-banners', uniqid('', true).'.'.$extension, 'public');
        }

        $board = Board::query()->create([
            'title' => $validated['title'],
            'subtitle' => $validated['subtitle'] ?? null,
            'image_path' => $imagePath,
            'cta_text' => $validated['cta_text'] ?? null,
            'cta_link' => $validated['cta_link'] ?? null,
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'starts_at' => $validated['starts_at'] ?? null,
            'ends_at' => $validated['ends_at'] ?? null,
            'priority' => $validated['priority'] ?? 0,
        ]);

        AdminAudit::record(
            $request,
            'board.create',
            'board',
            $board->id,
            null,
            $board->toApiArray()
        );

        $payload = $board->fresh()->toApiArray();

        return response()->json([
            'board' => $payload,
            // Backward-compatible alias for old clients.
            'banner' => $payload,
        ], 201);
    }

    public function update(Request $request, Board $board)
    {
        $before = $board->toApiArray();

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'subtitle' => ['sometimes', 'nullable', 'string'],
            'image' => ['sometimes', 'nullable', 'image', 'max:5120'],
            'cta_text' => ['sometimes', 'nullable', 'string', 'max:120'],
            'cta_link' => ['sometimes', 'nullable', 'url', 'max:2048'],
            'is_active' => ['sometimes', 'nullable', 'boolean'],
            'starts_at' => ['sometimes', 'nullable', 'date'],
            'ends_at' => [
                'sometimes',
                'nullable',
                'date',
                function (string $attribute, mixed $value, Closure $fail) use ($request, $board): void {
                    if ($value === null || $value === '') {
                        return;
                    }

                    $starts = $request->exists('starts_at')
                        ? $request->date('starts_at')
                        : $board->starts_at;
                    $ends = $request->date('ends_at');

                    if ($starts && $ends && $ends->lt($starts)) {
                        $fail('The ends at must be a date after or equal to starts at.');
                    }
                },
            ],
            'priority' => ['sometimes', 'nullable', 'integer', 'min:0'],
        ]);

        if ($request->hasFile('image')) {
            if ($board->image_path) {
                Storage::disk('public')->delete($board->image_path);
            }
            $file = $request->file('image');
            $extension = $file->guessExtension() ?: 'jpg';
            $validated['image_path'] = $file->storeAs('hero-banners', uniqid('', true).'.'.$extension, 'public');
        }

        $board->fill(
            collect($validated)->except(['image'])->all()
        )->save();

        AdminAudit::record(
            $request,
            'board.update',
            'board',
            $board->id,
            $before,
            $board->fresh()->toApiArray()
        );

        $payload = $board->fresh()->toApiArray();

        return response()->json([
            'board' => $payload,
            // Backward-compatible alias for old clients.
            'banner' => $payload,
        ]);
    }

    public function destroy(Request $request, Board $board)
    {
        $before = $board->toApiArray();

        if ($board->image_path) {
            Storage::disk('public')->delete($board->image_path);
        }

        $board->delete();

        AdminAudit::record(
            $request,
            'board.delete',
            'board',
            $board->id,
            $before,
            null
        );

        return response()->json([
            'message' => 'Board deleted successfully.',
        ]);
    }

    public function duplicate(Request $request, Board $board)
    {
        if (Board::query()->count() >= 5) {
            return response()->json([
                'message' => 'Maximum 5 boards allowed.',
            ], 422);
        }

        $newImagePath = null;
        if ($board->image_path && Storage::disk('public')->exists($board->image_path)) {
            $source = $board->image_path;
            $extension = pathinfo($source, PATHINFO_EXTENSION) ?: 'jpg';
            $newImagePath = 'hero-banners/'.uniqid('', true).'.'.$extension;
            Storage::disk('public')->copy($source, $newImagePath);
        }

        $clone = Board::query()->create([
            'title' => $board->title.' (Copy)',
            'subtitle' => $board->subtitle,
            'image_path' => $newImagePath,
            'cta_text' => $board->cta_text,
            'cta_link' => $board->cta_link,
            'is_active' => false,
            'starts_at' => $board->starts_at,
            'ends_at' => $board->ends_at,
            'priority' => $board->priority,
        ]);

        AdminAudit::record(
            $request,
            'board.duplicate',
            'board',
            $clone->id,
            null,
            $clone->toApiArray(),
            [
                'source_board_id' => $board->id,
            ]
        );

        $payload = $clone->fresh()->toApiArray();

        return response()->json([
            'board' => $payload,
            'banner' => $payload,
        ], 201);
    }

    public function toggleActive(Request $request, Board $board)
    {
        $before = $board->toApiArray();
        $board->is_active = ! (bool) $board->is_active;
        $board->save();

        AdminAudit::record(
            $request,
            'board.toggle_active',
            'board',
            $board->id,
            $before,
            $board->fresh()->toApiArray()
        );

        $payload = $board->fresh()->toApiArray();

        return response()->json([
            'board' => $payload,
            'banner' => $payload,
        ]);
    }

    public function shiftPriority(Request $request, Board $board)
    {
        $before = $board->toApiArray();
        $validated = $request->validate([
            'direction' => ['required', 'in:up,down'],
            'step' => ['nullable', 'integer', 'min:1', 'max:20'],
        ]);

        $step = (int) ($validated['step'] ?? 1);
        $current = (int) $board->priority;

        if ($validated['direction'] === 'up') {
            $board->priority = $current + $step;
        } else {
            $board->priority = max(0, $current - $step);
        }

        $board->save();

        AdminAudit::record(
            $request,
            'board.shift_priority',
            'board',
            $board->id,
            $before,
            $board->fresh()->toApiArray(),
            [
                'direction' => $validated['direction'],
                'step' => $step,
            ]
        );

        $payload = $board->fresh()->toApiArray();

        return response()->json([
            'board' => $payload,
            'banner' => $payload,
        ]);
    }

    private function applyIndexSort(Builder $query, string $sort): void
    {
        if ($sort === 'oldest') {
            $query->orderBy('id');
            return;
        }

        if ($sort === 'priority_desc') {
            $query->orderByDesc('priority')->orderByDesc('id');
            return;
        }

        if ($sort === 'priority_asc') {
            $query->orderBy('priority')->orderByDesc('id');
            return;
        }

        if ($sort === 'title_asc') {
            $query->orderBy('title')->orderByDesc('id');
            return;
        }

        if ($sort === 'title_desc') {
            $query->orderByDesc('title')->orderByDesc('id');
            return;
        }

        if ($sort === 'active_first') {
            $query->orderByDesc('is_active')->orderByDesc('id');
            return;
        }

        $query->orderByDesc('id');
    }
}
