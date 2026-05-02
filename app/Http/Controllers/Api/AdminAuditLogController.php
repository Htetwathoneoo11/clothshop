<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminActivityLog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class AdminAuditLogController extends Controller
{
    public function index(Request $request)
    {
        $search = trim((string) $request->query('q', ''));
        $action = trim((string) $request->query('action', 'all'));
        $targetType = trim((string) $request->query('target_type', 'all'));
        $actorId = trim((string) $request->query('actor_id', 'all'));
        $sort = trim((string) $request->query('sort', 'newest'));
        $perPage = max(1, min(30, (int) $request->query('per_page', 12)));

        $logs = AdminActivityLog::query()
            ->with('actor')
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $subQuery) use ($search): void {
                    if (ctype_digit($search)) {
                        $subQuery->where('id', (int) $search)
                            ->orWhere('target_id', (int) $search);
                    }

                    $subQuery->orWhere('action', 'like', '%'.$search.'%')
                        ->orWhere('target_type', 'like', '%'.$search.'%')
                        ->orWhere('before_state', 'like', '%'.$search.'%')
                        ->orWhere('after_state', 'like', '%'.$search.'%')
                        ->orWhere('meta', 'like', '%'.$search.'%')
                        ->orWhereHas('actor', function (Builder $actorQuery) use ($search): void {
                            $actorQuery->where('username', 'like', '%'.$search.'%')
                                ->orWhere('email', 'like', '%'.$search.'%');
                        });
                });
            })
            ->when($action !== 'all' && $action !== '', fn (Builder $query) => $query->where('action', $action))
            ->when($targetType !== 'all' && $targetType !== '', fn (Builder $query) => $query->where('target_type', $targetType))
            ->when(ctype_digit($actorId), fn (Builder $query) => $query->where('actor_id', (int) $actorId));

        if ($sort === 'oldest') {
            $logs->orderBy('id');
        } else {
            $logs->orderByDesc('id');
        }

        $paginated = $logs->paginate($perPage)->withQueryString();

        return response()->json([
            'logs' => collect($paginated->items())
                ->map(fn (AdminActivityLog $log) => $this->serializeLog($log))
                ->values()
                ->all(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
            'filters' => [
                'q' => $search,
                'action' => $action,
                'target_type' => $targetType,
                'actor_id' => $actorId,
                'sort' => $sort,
            ],
            'options' => [
                'actions' => AdminActivityLog::query()
                    ->select('action')
                    ->distinct()
                    ->orderBy('action')
                    ->pluck('action')
                    ->values()
                    ->all(),
                'target_types' => AdminActivityLog::query()
                    ->select('target_type')
                    ->distinct()
                    ->orderBy('target_type')
                    ->pluck('target_type')
                    ->values()
                    ->all(),
                'actors' => AdminActivityLog::query()
                    ->with('actor')
                    ->whereNotNull('actor_id')
                    ->select('actor_id')
                    ->distinct()
                    ->get()
                    ->map(fn (AdminActivityLog $log) => $log->actor ? [
                        'id' => $log->actor->id,
                        'username' => $log->actor->username,
                        'email' => $log->actor->email,
                    ] : null)
                    ->filter()
                    ->sortBy('username')
                    ->values()
                    ->all(),
            ],
        ]);
    }

    public function show(AdminActivityLog $auditLog)
    {
        return response()->json([
            'log' => $this->serializeLog($auditLog->load('actor'), true),
        ]);
    }

    private function serializeLog(AdminActivityLog $log, bool $includeState = true): array
    {
        $payload = [
            'id' => $log->id,
            'actor' => $log->actor ? [
                'id' => $log->actor->id,
                'username' => $log->actor->username,
                'email' => $log->actor->email,
            ] : null,
            'action' => $log->action,
            'target_type' => $log->target_type,
            'target_id' => $log->target_id,
            'created_at' => $log->created_at?->toIso8601String(),
            'meta' => $log->meta,
        ];

        if ($includeState) {
            $payload['before_state'] = $log->before_state;
            $payload['after_state'] = $log->after_state;
        }

        return $payload;
    }
}
