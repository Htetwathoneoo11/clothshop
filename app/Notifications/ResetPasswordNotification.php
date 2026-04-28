<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

class ResetPasswordNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly string $token)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $resetUrl = $this->resetUrl($notifiable);
        $expiresAt = Carbon::now()->addMinutes((int) config('auth.passwords.users.expire', 60));

        return (new MailMessage)
            ->subject('Reset your Clothshop password')
            ->view('emails.reset-password', [
                'user' => $notifiable,
                'resetUrl' => $resetUrl,
                'expiresAt' => $expiresAt,
            ]);
    }

    private function resetUrl(object $notifiable): string
    {
        $baseUrl = rtrim((string) config('app.url'), '/');
        $email = urlencode((string) $notifiable->getEmailForPasswordReset());

        return "{$baseUrl}/clothshop/reset-password?token={$this->token}&email={$email}";
    }
}
