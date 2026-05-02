<?php

namespace App\Notifications;

use App\Models\StaffInvitation;
use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class StaffInvitationNotification extends Notification
{
    public function __construct(
        private readonly StaffInvitation $invitation,
        private readonly string $acceptUrl
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('You have been invited to Clothshop Admin')
            ->view('emails.staff-invitation', [
                'invitation' => $this->invitation,
                'roleLabel' => User::ROLE_LABELS[(int) $this->invitation->role] ?? 'Admin',
                'acceptUrl' => $this->acceptUrl,
            ]);
    }

    public function invitationId(): int
    {
        return (int) $this->invitation->id;
    }
}
