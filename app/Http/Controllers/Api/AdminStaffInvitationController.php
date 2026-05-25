<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StaffInvitation;
use App\Models\User;
use App\Notifications\StaffInvitationNotification;
use App\Support\AdminAudit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Throwable;

class AdminStaffInvitationController extends Controller
{
    public function index()
    {
        $invitations = StaffInvitation::query()
            ->with(['inviter', 'acceptedUser'])
            ->orderByDesc('id')
            ->limit(20)
            ->get()
            ->map(fn (StaffInvitation $invitation): array => $this->serializeInvitation($invitation))
            ->values();

        return response()->json([
            'invitations' => $invitations,
            'roles' => collect(StaffInvitation::INVITABLE_ROLES)
                ->map(fn (int $role): array => [
                    'value' => $role,
                    'label' => User::ROLE_LABELS[$role] ?? 'Admin',
                ])
                ->values()
                ->all(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'username' => ['required', 'string', 'max:255', 'unique:users,username'],
            'role' => ['required', 'integer', Rule::in(StaffInvitation::INVITABLE_ROLES)],
            'expires_in_days' => ['nullable', 'integer', 'min:1', 'max:30'],
        ]);

        $existingPending = StaffInvitation::query()
            ->where(function ($query) use ($validated): void {
                $query->where('email', $validated['email'])
                    ->orWhere('username', $validated['username']);
            })
            ->whereNull('accepted_at')
            ->whereNull('cancelled_at')
            ->where('expires_at', '>', now())
            ->exists();

        if ($existingPending) {
            return response()->json([
                'message' => 'A pending staff invitation already exists for that email or username.',
            ], 422);
        }

        $token = Str::random(64);
        $invitation = StaffInvitation::query()->create([
            'email' => $validated['email'],
            'username' => $validated['username'],
            'role' => (int) $validated['role'],
            'token_hash' => hash('sha256', $token),
            'invited_by' => $request->user()?->id,
            'expires_at' => now()->addDays((int) ($validated['expires_in_days'] ?? 7)),
        ]);
        $acceptUrl = $this->acceptUrl($token);

        AdminAudit::record(
            $request,
            'staff_invitation.create',
            'staff_invitation',
            $invitation->id,
            null,
            $this->invitationSnapshot($invitation)
        );

        $emailSent = true;
        try {
            Notification::route('mail', $invitation->email)
                ->notify(new StaffInvitationNotification($invitation, $acceptUrl));
        } catch (Throwable $exception) {
            $emailSent = false;
            Log::error('Staff invitation email could not be sent.', [
                'staff_invitation_id' => $invitation->id,
                'email' => $invitation->email,
                'exception' => $exception,
            ]);
        }

        return response()->json([
            'invitation' => $this->serializeInvitation($invitation, $token),
            'email_sent' => $emailSent,
            'message' => $emailSent
                ? 'Invitation email sent.'
                : 'Invitation link created, but the email could not be sent. Copy the invite link and send it manually.',
        ], 201);
    }

    public function cancel(Request $request, StaffInvitation $staffInvitation)
    {
        if (! $staffInvitation->isPending()) {
            return response()->json([
                'message' => 'Only pending invitations can be cancelled.',
            ], 422);
        }

        $before = $this->invitationSnapshot($staffInvitation);
        $staffInvitation->forceFill(['cancelled_at' => now()])->save();

        AdminAudit::record(
            $request,
            'staff_invitation.cancel',
            'staff_invitation',
            $staffInvitation->id,
            $before,
            $this->invitationSnapshot($staffInvitation->fresh())
        );

        return response()->json([
            'invitation' => $this->serializeInvitation($staffInvitation->fresh(['inviter', 'acceptedUser'])),
        ]);
    }

    public function accept(Request $request)
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        $invitation = StaffInvitation::query()
            ->where('token_hash', hash('sha256', $validated['token']))
            ->first();

        if (! $invitation || ! $invitation->isPending()) {
            return response()->json([
                'message' => 'This staff invitation is invalid or has expired.',
            ], 422);
        }

        $user = DB::transaction(function () use ($invitation, $validated): User {
            $user = User::query()->create([
                'username' => $invitation->username,
                'email' => $invitation->email,
                'password' => Hash::make($validated['password']),
                'role' => $invitation->role,
                'status' => 1,
            ]);
            $user->forceFill(['email_verified_at' => now()])->save();

            $invitation->forceFill([
                'accepted_user_id' => $user->id,
                'accepted_at' => now(),
            ])->save();

            return $user;
        });

        Auth::guard('web')->logout();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        Auth::guard('web')->login($user);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }
        $this->updateLoginMeta($request, $user);

        return response()->json([
            'message' => 'Staff account created. You are now signed in.',
            'user' => $user->fresh()->toApiArray(),
        ], 201);
    }

    private function serializeInvitation(StaffInvitation $invitation, ?string $token = null): array
    {
        $payload = [
            'id' => $invitation->id,
            'email' => $invitation->email,
            'username' => $invitation->username,
            'role' => (int) $invitation->role,
            'role_label' => User::ROLE_LABELS[(int) $invitation->role] ?? 'Admin',
            'status' => $invitation->statusLabel(),
            'expires_at' => $invitation->expires_at?->toIso8601String(),
            'accepted_at' => $invitation->accepted_at?->toIso8601String(),
            'cancelled_at' => $invitation->cancelled_at?->toIso8601String(),
            'created_at' => $invitation->created_at?->toIso8601String(),
            'inviter' => $invitation->inviter ? [
                'id' => $invitation->inviter->id,
                'username' => $invitation->inviter->username,
                'email' => $invitation->inviter->email,
            ] : null,
            'accepted_user' => $invitation->acceptedUser ? [
                'id' => $invitation->acceptedUser->id,
                'username' => $invitation->acceptedUser->username,
                'email' => $invitation->acceptedUser->email,
            ] : null,
        ];

        if ($token) {
            $payload['token'] = $token;
            $payload['accept_url'] = $this->acceptUrl($token);
        }

        return $payload;
    }

    private function acceptUrl(string $token): string
    {
        return url('/clothshop/staff-invitation/accept?token='.$token);
    }

    private function invitationSnapshot(StaffInvitation $invitation): array
    {
        return [
            'id' => $invitation->id,
            'email' => $invitation->email,
            'username' => $invitation->username,
            'role' => (int) $invitation->role,
            'status' => $invitation->statusLabel(),
            'expires_at' => $invitation->expires_at?->toIso8601String(),
        ];
    }

    private function updateLoginMeta(Request $request, User $user): void
    {
        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1000),
        ])->save();
    }
}
