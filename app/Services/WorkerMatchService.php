<?php

namespace App\Services;

use App\Models\Worker;

class WorkerMatchService
{
    public function findBestMatch(?string $rut, ?string $fullName): ?array
    {
        if ($rutMatch = $this->matchByRut($rut)) {
            return $rutMatch;
        }

        return $this->matchByName($fullName);
    }

    protected function matchByRut(?string $rut): ?array
    {
        $normalizedRut = $this->normalizeRut($rut);
        if ($normalizedRut === null) {
            return null;
        }

        $worker = Worker::query()
            ->where(function ($query) use ($normalizedRut) {
                $query->whereRaw("REGEXP_REPLACE(COALESCE(rut, ''), '[^0-9kK]', '', 'gi') = ?", [$normalizedRut])
                    ->orWhereRaw("REGEXP_REPLACE(COALESCE(pasaporte, ''), '[^A-Za-z0-9]', '', 'g') = ?", [$normalizedRut]);
            })
            ->first();

        if (! $worker) {
            return null;
        }

        return [
            'worker' => $worker,
            'strategy' => 'rut_exact',
            'score' => 100,
        ];
    }

    protected function matchByName(?string $fullName): ?array
    {
        $normalizedName = $this->normalizeText($fullName);
        if ($normalizedName === '') {
            return null;
        }

        $tokens = collect(explode(' ', $normalizedName))
            ->filter(fn ($token) => mb_strlen($token) >= 3)
            ->values();

        if ($tokens->isEmpty()) {
            return null;
        }

        $candidates = Worker::query()
            ->select(['id', 'rut', 'pasaporte', 'nombres', 'apellido_paterno', 'apellido_materno', 'name', 'position', 'tipo_contrato'])
            ->where(function ($query) use ($tokens) {
                foreach ($tokens->take(3) as $token) {
                    $query->orWhere('nombres', 'ilike', "%{$token}%")
                        ->orWhere('apellido_paterno', 'ilike', "%{$token}%")
                        ->orWhere('apellido_materno', 'ilike', "%{$token}%")
                        ->orWhere('name', 'ilike', "%{$token}%");
                }
            })
            ->limit(25)
            ->get();

        if ($candidates->isEmpty()) {
            return null;
        }

        $ranked = $candidates
            ->map(function (Worker $worker) use ($normalizedName, $tokens) {
                $workerName = $this->normalizeText(
                    trim(implode(' ', array_filter([
                        $worker->nombres,
                        $worker->apellido_paterno,
                        $worker->apellido_materno,
                    ])))
                );

                similar_text($normalizedName, $workerName, $similarityPercent);

                $workerTokens = collect(explode(' ', $workerName))
                    ->filter()
                    ->values();

                $tokenHits = $tokens->intersect($workerTokens)->count();
                $tokenCoverage = $tokens->count() > 0
                    ? ($tokenHits / $tokens->count()) * 100
                    : 0;

                $score = ($similarityPercent * 0.7) + ($tokenCoverage * 0.3);

                return [
                    'worker' => $worker,
                    'strategy' => 'name_similarity',
                    'score' => round($score, 2),
                    'token_hits' => $tokenHits,
                ];
            })
            ->sortByDesc('score')
            ->values();

        $best = $ranked->first();
        if (! $best) {
            return null;
        }

        if (($best['score'] ?? 0) < 70 && ($best['token_hits'] ?? 0) < 2) {
            return null;
        }

        return $best;
    }

    protected function normalizeRut(?string $rut): ?string
    {
        if (! $rut) {
            return null;
        }

        $normalized = strtolower(preg_replace('/[^0-9kK]/i', '', $rut));

        return $normalized !== '' ? $normalized : null;
    }

    protected function normalizeText(?string $value): string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return '';
        }

        $value = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
        $value = strtolower($value);
        $value = preg_replace('/[^a-z0-9\s]/', ' ', $value);
        $value = preg_replace('/\s+/', ' ', (string) $value);

        return trim((string) $value);
    }
}
