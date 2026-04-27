<?php

namespace Tests\Feature;

use App\Models\AdminActivityLog;
use App\Models\Board;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BoardTest extends TestCase
{
    use RefreshDatabase;

    /** @var string 1×1 transparent GIF (no GD required for UploadedFile::fake) */
    private const FAKE_IMAGE_BYTES = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    private function fakeImageUpload(string $filename = 'hero.gif'): UploadedFile
    {
        return UploadedFile::fake()->create($filename, base64_decode(self::FAKE_IMAGE_BYTES, true));
    }

    private function createBanner(array $overrides = []): Board
    {
        return Board::query()->create(array_merge([
            'title' => 'Banner '.uniqid(),
            'subtitle' => null,
            'image_path' => null,
            'cta_text' => null,
            'cta_link' => null,
            'is_active' => true,
            'starts_at' => null,
            'ends_at' => null,
            'priority' => 0,
        ], $overrides));
    }

    public function test_public_active_returns_null_when_no_active_banners(): void
    {
        $this->createBanner(['is_active' => false]);

        $this->getJson('/api/boards/active')
            ->assertOk()
            ->assertJson(['board' => null]);
    }

    public function test_public_active_returns_highest_priority_valid_banner(): void
    {
        $this->travelTo(now()->startOfSecond());
        try {
            $this->createBanner([
                'title' => 'Inactive hot',
                'is_active' => false,
                'priority' => 999,
            ]);
            $this->createBanner([
                'title' => 'Future start',
                'is_active' => true,
                'starts_at' => now()->addDay(),
                'priority' => 888,
            ]);
            $this->createBanner([
                'title' => 'Expired',
                'is_active' => true,
                'starts_at' => now()->subDays(5),
                'ends_at' => now()->subDay(),
                'priority' => 777,
            ]);
            $this->createBanner([
                'title' => 'Valid low priority',
                'is_active' => true,
                'priority' => 5,
            ]);
            $this->createBanner([
                'title' => 'Winner by priority',
                'is_active' => true,
                'priority' => 10,
            ]);
            $this->createBanner([
                'title' => 'Winner tie lower id',
                'is_active' => true,
                'priority' => 10,
            ]);

            $expected = Board::query()
                ->where('title', 'Winner tie lower id')
                ->first();

            $this->assertNotNull($expected);

            $this->getJson('/api/boards/active')
                ->assertOk()
                ->assertJsonPath('board.title', 'Winner tie lower id')
                ->assertJsonPath('board.id', $expected->id);
        } finally {
            $this->travelBack();
        }
    }

    public function test_admin_endpoints_require_authentication(): void
    {
        $banner = $this->createBanner();

        $this->postJson('/api/admin/boards', ['title' => 'X'])->assertUnauthorized();
        $this->postJson('/api/admin/boards/'.$banner->id.'/duplicate')->assertUnauthorized();
        $this->postJson('/api/admin/boards/'.$banner->id.'/toggle-active')->assertUnauthorized();
        $this->postJson('/api/admin/boards/'.$banner->id.'/shift-priority', ['direction' => 'up'])->assertUnauthorized();
        $this->putJson('/api/admin/boards/'.$banner->id, ['title' => 'Y'])->assertUnauthorized();
        $this->deleteJson('/api/admin/boards/'.$banner->id)->assertUnauthorized();
        $this->getJson('/api/admin/boards')->assertUnauthorized();
    }

    public function test_non_admin_authenticated_user_is_forbidden_on_admin_routes(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_USER]);
        $banner = $this->createBanner();

        $this->actingAs($user)->postJson('/api/admin/boards', ['title' => 'X'])
            ->assertForbidden();
        $this->actingAs($user)->postJson('/api/admin/boards/'.$banner->id.'/duplicate')
            ->assertForbidden();
        $this->actingAs($user)->postJson('/api/admin/boards/'.$banner->id.'/toggle-active')
            ->assertForbidden();
        $this->actingAs($user)->postJson('/api/admin/boards/'.$banner->id.'/shift-priority', ['direction' => 'up'])
            ->assertForbidden();
        $this->actingAs($user)->putJson('/api/admin/boards/'.$banner->id, ['title' => 'Y'])
            ->assertForbidden();
        $this->actingAs($user)->deleteJson('/api/admin/boards/'.$banner->id)
            ->assertForbidden();
        $this->actingAs($user)->getJson('/api/admin/boards')
            ->assertForbidden();
    }

    public function test_admin_can_crud_banners(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $create = $this->actingAs($admin)->postJson('/api/admin/boards', [
            'title' => 'Summer drop',
            'is_active' => true,
        ]);

        $create->assertCreated()
            ->assertJsonPath('board.title', 'Summer drop')
            ->assertJsonPath('board.is_active', true);

        $id = $create->json('board.id');

        $this->actingAs($admin)->getJson('/api/admin/boards')
            ->assertOk()
            ->assertJsonFragment(['id' => $id, 'title' => 'Summer drop']);

        $this->actingAs($admin)->putJson('/api/admin/boards/'.$id, [
            'title' => 'Summer drop refreshed',
        ])
            ->assertOk()
            ->assertJsonPath('board.title', 'Summer drop refreshed');

        $this->assertDatabaseHas('hero_banners', [
            'id' => $id,
            'title' => 'Summer drop refreshed',
        ]);

        $this->actingAs($admin)->deleteJson('/api/admin/boards/'.$id)
            ->assertOk()
            ->assertJsonPath('message', 'Board deleted successfully.');

        $this->assertDatabaseMissing('hero_banners', ['id' => $id]);
    }

    public function test_store_validation_errors(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->actingAs($admin)->postJson('/api/admin/boards', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title']);

        $this->actingAs($admin)->postJson('/api/admin/boards', [
            'title' => 'Ok title',
            'cta_link' => 'not-a-valid-url',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['cta_link']);

        $this->actingAs($admin)->postJson('/api/admin/boards', [
            'title' => 'Date range',
            'starts_at' => '2026-06-10T00:00:00Z',
            'ends_at' => '2026-06-01T00:00:00Z',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['ends_at']);
    }

    public function test_admin_cannot_create_more_than_five_boards(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        for ($i = 1; $i <= 5; $i++) {
            $this->createBanner(['title' => 'Board '.$i]);
        }

        $this->actingAs($admin)->postJson('/api/admin/boards', [
            'title' => 'Board 6',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Maximum 5 boards allowed.');
    }

    public function test_image_upload_store_update_and_delete_with_storage_fake(): void
    {
        Storage::fake('public');

        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $file = $this->fakeImageUpload('hero.gif');

        $create = $this->actingAs($admin)
            ->withHeader('Accept', 'application/json')
            ->post('/api/admin/boards', [
                'title' => 'With image',
                'image' => $file,
            ]);

        $create->assertCreated();
        $banner = Board::query()->first();
        $this->assertNotNull($banner);
        $this->assertNotNull($banner->image_path);
        Storage::disk('public')->assertExists($banner->image_path);

        $oldPath = $banner->image_path;
        $newFile = $this->fakeImageUpload('hero2.gif');

        $this->actingAs($admin)
            ->withHeader('Accept', 'application/json')
            ->put('/api/admin/boards/'.$banner->id, [
                'image' => $newFile,
            ])
            ->assertOk();

        $banner->refresh();
        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists($banner->image_path);
        $this->assertNotSame($oldPath, $banner->image_path);

        $this->actingAs($admin)->deleteJson('/api/admin/boards/'.$banner->id)
            ->assertOk();

        Storage::disk('public')->assertMissing($banner->image_path);
        $this->assertDatabaseMissing('hero_banners', ['id' => $banner->id]);
    }

    public function test_admin_boards_index_supports_search_filter_sort_and_pagination(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->createBanner([
            'title' => 'Zeta board',
            'subtitle' => 'Winter sale',
            'is_active' => true,
            'priority' => 5,
        ]);
        $this->createBanner([
            'title' => 'Alpha board',
            'subtitle' => 'Spring sale',
            'is_active' => true,
            'priority' => 2,
        ]);
        $this->createBanner([
            'title' => 'Hidden board',
            'subtitle' => 'Inactive only',
            'is_active' => false,
            'priority' => 8,
        ]);

        $default = $this->actingAs($admin)->getJson('/api/admin/boards')
            ->assertOk()
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('filters.status', 'all');

        $defaultNames = collect($default->json('boards'))->pluck('title');
        $this->assertTrue($defaultNames->contains('Zeta board'));
        $this->assertTrue($defaultNames->contains('Alpha board'));
        $this->assertTrue($defaultNames->contains('Hidden board'));

        $inactive = $this->actingAs($admin)->getJson('/api/admin/boards?status=inactive')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('boards.0.title', 'Hidden board');

        $search = $this->actingAs($admin)->getJson('/api/admin/boards?q=spring')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('boards.0.title', 'Alpha board');

        $prioritySorted = $this->actingAs($admin)->getJson('/api/admin/boards?sort=priority_desc')
            ->assertOk();
        $this->assertSame(
            ['Hidden board', 'Zeta board', 'Alpha board'],
            collect($prioritySorted->json('boards'))->pluck('title')->values()->all()
        );

        $pageOne = $this->actingAs($admin)->getJson('/api/admin/boards?sort=title_asc&per_page=2&page=1')
            ->assertOk()
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('boards.0.title', 'Alpha board')
            ->assertJsonPath('boards.1.title', 'Hidden board');

        $this->actingAs($admin)->getJson('/api/admin/boards?sort=title_asc&per_page=2&page=2')
            ->assertOk()
            ->assertJsonPath('boards.0.title', 'Zeta board');
    }

    public function test_admin_can_use_quick_actions_duplicate_toggle_and_shift_priority(): void
    {
        Storage::fake('public');
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $board = $this->createBanner([
            'title' => 'Starter board',
            'is_active' => true,
            'priority' => 2,
        ]);

        $toggle = $this->actingAs($admin)->postJson('/api/admin/boards/'.$board->id.'/toggle-active')
            ->assertOk()
            ->assertJsonPath('board.is_active', false);

        $this->assertFalse((bool) $toggle->json('board.is_active'));

        $shiftUp = $this->actingAs($admin)->postJson('/api/admin/boards/'.$board->id.'/shift-priority', [
            'direction' => 'up',
            'step' => 3,
        ])->assertOk()
            ->assertJsonPath('board.priority', 5);

        $this->assertSame(5, (int) $shiftUp->json('board.priority'));

        $shiftDown = $this->actingAs($admin)->postJson('/api/admin/boards/'.$board->id.'/shift-priority', [
            'direction' => 'down',
            'step' => 10,
        ])->assertOk()
            ->assertJsonPath('board.priority', 0);

        $this->assertSame(0, (int) $shiftDown->json('board.priority'));

        $duplicate = $this->actingAs($admin)->postJson('/api/admin/boards/'.$board->id.'/duplicate')
            ->assertCreated()
            ->assertJsonPath('board.title', 'Starter board (Copy)')
            ->assertJsonPath('board.is_active', false)
            ->assertJsonPath('board.priority', 0);

        $this->assertDatabaseHas('hero_banners', [
            'id' => $duplicate->json('board.id'),
            'title' => 'Starter board (Copy)',
            'is_active' => 0,
            'priority' => 0,
        ]);

        for ($i = 0; $i < 3; $i++) {
            $this->createBanner(['title' => 'Filler '.$i]);
        }

        $this->actingAs($admin)->postJson('/api/admin/boards/'.$board->id.'/duplicate')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Maximum 5 boards allowed.');
    }

    public function test_admin_quick_action_operations_are_reversible_for_undo_pathways(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $board = $this->createBanner([
            'title' => 'Undo board',
            'is_active' => true,
            'priority' => 4,
        ]);

        $initialCount = Board::query()->count();
        $initialPriority = (int) $board->priority;

        $this->actingAs($admin)->postJson('/api/admin/boards/'.$board->id.'/toggle-active')
            ->assertOk()
            ->assertJsonPath('board.is_active', false);

        $this->actingAs($admin)->postJson('/api/admin/boards/'.$board->id.'/toggle-active')
            ->assertOk()
            ->assertJsonPath('board.is_active', true);

        $this->actingAs($admin)->postJson('/api/admin/boards/'.$board->id.'/shift-priority', [
            'direction' => 'up',
            'step' => 2,
        ])->assertOk();

        $undoPriority = $this->actingAs($admin)->postJson('/api/admin/boards/'.$board->id.'/shift-priority', [
            'direction' => 'down',
            'step' => 2,
        ])->assertOk();

        $this->assertSame($initialPriority, (int) $undoPriority->json('board.priority'));

        $dup = $this->actingAs($admin)->postJson('/api/admin/boards/'.$board->id.'/duplicate')
            ->assertCreated();

        $dupId = (int) $dup->json('board.id');
        $this->assertSame($initialCount + 1, Board::query()->count());

        $this->actingAs($admin)->deleteJson('/api/admin/boards/'.$dupId)->assertOk();
        $this->assertSame($initialCount, Board::query()->count());
    }

    public function test_board_mutations_write_audit_logs(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $created = $this->actingAs($admin)->postJson('/api/admin/boards', [
            'title' => 'Audit Board',
            'is_active' => true,
            'priority' => 1,
        ])->assertCreated();

        $boardId = (int) $created->json('board.id');

        $this->actingAs($admin)->putJson('/api/admin/boards/'.$boardId, [
            'title' => 'Audit Board Updated',
        ])->assertOk();

        $this->actingAs($admin)->postJson('/api/admin/boards/'.$boardId.'/toggle-active')
            ->assertOk();

        $this->assertDatabaseHas('admin_activity_logs', [
            'actor_id' => $admin->id,
            'action' => 'board.create',
            'target_type' => 'board',
            'target_id' => $boardId,
        ]);

        $this->assertDatabaseHas('admin_activity_logs', [
            'actor_id' => $admin->id,
            'action' => 'board.update',
            'target_type' => 'board',
            'target_id' => $boardId,
        ]);

        $this->assertDatabaseHas('admin_activity_logs', [
            'actor_id' => $admin->id,
            'action' => 'board.toggle_active',
            'target_type' => 'board',
            'target_id' => $boardId,
        ]);

        $this->assertSame(
            3,
            AdminActivityLog::query()
                ->where('actor_id', $admin->id)
                ->whereIn('action', ['board.create', 'board.update', 'board.toggle_active'])
                ->count()
        );
    }
}










