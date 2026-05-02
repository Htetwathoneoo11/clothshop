<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clothshop admin invitation</title>
</head>
<body style="margin: 0; padding: 0; background: #f6f2ee; font-family: Arial, Helvetica, sans-serif; color: #1c1917;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f6f2ee; padding: 32px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; background: #ffffff; border: 1px solid #e7dfd8; border-radius: 12px; overflow: hidden;">
                    <tr>
                        <td style="background: #1c1917; padding: 24px 28px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" style="width: 100%;">
                                <tr>
                                    <td width="48" valign="middle" style="width: 48px;">
                                        <img src="{{ asset('images/logo2.png') }}" alt="Clothshop logo" width="40" height="40" style="display: block; width: 40px; height: 40px; border-radius: 10px; background: #ffffff;">
                                    </td>
                                    <td valign="middle" style="padding-left: 12px;">
                                        <div style="font-size: 22px; line-height: 1.2; font-weight: 700; color: #ffffff;">
                                            Clothshop Admin
                                        </div>
                                        <div style="margin-top: 4px; font-size: 13px; line-height: 1.5; color: #d6d3d1;">
                                            Staff access invitation
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 28px 12px;">
                            <h1 style="margin: 0; font-size: 24px; line-height: 1.3; color: #1c1917;">
                                You are invited to join Clothshop Admin
                            </h1>
                            <p style="margin: 18px 0 0; font-size: 15px; line-height: 1.7; color: #57534e;">
                                Hi {{ $invitation->username }},
                            </p>
                            <p style="margin: 12px 0 0; font-size: 15px; line-height: 1.7; color: #57534e;">
                                A Clothshop Super Admin invited you as <strong>{{ $roleLabel }}</strong>. Use the button below to set your password and activate your staff account.
                            </p>
                            <p style="margin: 12px 0 0; font-size: 15px; line-height: 1.7; color: #57534e;">
                                This invite expires on {{ optional($invitation->expires_at)->format('M j, Y g:i A') }}.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 22px 28px;">
                            <a href="{{ $acceptUrl }}" style="display: inline-block; padding: 13px 22px; background: #c2410c; border-radius: 8px; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none;">
                                Accept invitation
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 28px 28px;">
                            <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #78716c;">
                                If you were not expecting this invite, you can ignore this email.
                            </p>
                            <p style="margin: 18px 0 0; font-size: 12px; line-height: 1.6; color: #a8a29e;">
                                If the button does not work, paste this link into your browser:<br>
                                <a href="{{ $acceptUrl }}" style="color: #c2410c; word-break: break-all;">{{ $acceptUrl }}</a>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 18px 28px; background: #faf7f4; border-top: 1px solid #eee7e1;">
                            <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #78716c;">
                                Clothshop admin onboarding
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
