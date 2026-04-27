<?php

namespace App\Support;

use App\Models\AdminActivityLog;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;

class AdminAudit
{
    public static function record(
        Request $request,
        string $action,
        string $targetType,
        ?int $targetId = null,
        ?array $beforeState = null,
        ?array $afterState = null,
        ?array $meta = null
    ): void {
        if (! Schema::hasTable('admin_activity_logs')) {
            return;
        }

        try {
            AdminActivityLog::query()->create([
                'actor_id' => $request->user()?->id,
                'action' => $action,
                'target_type' => $targetType,
                'target_id' => $targetId,
                'before_state' => $beforeState,
                'after_state' => $afterState,
                'meta' => array_merge([
                    'ip' => $request->ip(),
                    'user_agent' => (string) $request->userAgent(),
                ], $meta ?? []),
            ]);
        } catch (QueryException) {
            // Keep business operations working even if audit storage is unavailable.
        }
    }
}
