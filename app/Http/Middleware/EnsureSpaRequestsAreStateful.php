<?php

namespace App\Http\Middleware;

use Illuminate\Support\Collection;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

class EnsureSpaRequestsAreStateful extends EnsureFrontendRequestsAreStateful
{
    public static function fromFrontend($request)
    {
        if (parent::fromFrontend($request)) {
            return true;
        }

        $host = $request->getHost();
        $port = $request->getPort();
        $hostWithPort = $port ? "{$host}:{$port}" : $host;

        return Collection::make(config('sanctum.stateful', []))
            ->map(fn ($domain) => trim((string) $domain))
            ->contains(fn ($domain) => $domain === $host || $domain === $hostWithPort);
    }
}
