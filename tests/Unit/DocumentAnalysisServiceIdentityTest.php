<?php

namespace Tests\Unit;

use App\Services\DocumentAnalysisService;
use Tests\TestCase;

class DocumentAnalysisServiceIdentityTest extends TestCase
{
    protected function service(): object
    {
        return new class extends DocumentAnalysisService
        {
            public function resolve(array $data, string $text): array
            {
                return $this->enforceMedicalRules($data, $text);
            }

            public function resolveForCategory(array $data, string $text, ?string $categoryName): array
            {
                return $this->enforceCategoryRules($this->enforceMedicalRules($data, $text), $categoryName);
            }

            public function usagePayload(string $source, bool $cached = false): array
            {
                return $this->buildUsagePayload($source, $cached);
            }

            public function latestExpiry(mixed $current, mixed $incoming): ?string
            {
                return $this->latestDate($current, $incoming);
            }
        };
    }

    public function test_invalid_worker_identifier_is_saved_as_passport_instead_of_rut(): void
    {
        $text = <<<'TEXT'
Nombre:
Miguel Vilcarani Turpo
R.U.T.:
L27618059
Razón:R.U.T.:76.693.253-3
TEXT;

        $result = $this->service()->resolve([
            'es_examen_salud' => true,
            'trabajador' => 'Miguel Vilcarani Turpo',
            'trabajador_rut' => 'L27618059',
            'estado_general' => 'apto',
            'imc' => ['valor' => 28.28, 'categoria' => 'Sobrepeso', 'alerta' => true, 'critico' => false],
            'drogas' => ['detectado' => false, 'sustancias' => [], 'alerta' => false, 'critico' => false, 'detalle' => 'Sin deteccion'],
            'otros_hallazgos' => [],
            'nivel_alerta' => 'alert',
        ], $text);

        $this->assertNull($result['trabajador_rut']);
        $this->assertSame('L27618059', $result['document_number']);
        $this->assertSame('passport', $result['document_number_type']);
    }

    public function test_medical_rules_force_critical_for_high_imc_and_positive_toxicology(): void
    {
        $text = <<<'TEXT'
Número de documento 18403453-0
IMC 32.97 kg/m2
ANFETAMINAS Presuntamente Positivo.
TEXT;

        $result = $this->service()->resolve([
            'es_examen_salud' => true,
            'trabajador' => 'Daniel Orostegui Cañas',
            'estado_general' => 'apto',
            'imc' => ['valor' => 32.97, 'categoria' => 'Sobrepeso', 'alerta' => true, 'critico' => false],
            'drogas' => ['detectado' => false, 'sustancias' => [], 'alerta' => false, 'critico' => false, 'detalle' => 'Sin deteccion'],
            'otros_hallazgos' => [],
            'nivel_alerta' => 'clean',
        ], $text);

        $this->assertSame('18403453-0', $result['trabajador_rut']);
        $this->assertSame('critical', $result['nivel_alerta']);
        $this->assertSame('apto', $result['estado_general']);
        $this->assertTrue($result['imc']['critico']);
        $this->assertTrue($result['drogas']['detectado']);
        $this->assertContains('anfetaminas', $result['drogas']['sustancias']);
    }

    public function test_presuntamente_positivo_para_anfetaminas_is_not_overridden_by_negative_text(): void
    {
        $text = <<<'TEXT'
Panel de drogas: negativo para benzodiazepinas, cocaina y cannabis.
Presuntamente positivo para anfetaminas.
El documento señala que el paciente está en tratamiento de control de peso con fentermina.
TEXT;

        $result = $this->service()->resolve([
            'es_examen_salud' => true,
            'trabajador' => 'Daniel Orostegui Cañas',
            'estado_general' => 'apto',
            'imc' => ['valor' => 26.2, 'categoria' => 'Sobrepeso', 'alerta' => false, 'critico' => false],
            'drogas' => [
                'detectado' => false,
                'sustancias' => [],
                'alerta' => false,
                'critico' => false,
                'detalle' => 'Presuntamente positivo para anfetaminas. El documento señala que el paciente está en tratamiento de control de peso con fentermina.',
            ],
            'otros_hallazgos' => [],
            'nivel_alerta' => 'clean',
        ], $text);

        $this->assertTrue($result['drogas']['detectado']);
        $this->assertTrue($result['drogas']['alerta']);
        $this->assertTrue($result['drogas']['critico']);
        $this->assertContains('anfetaminas', $result['drogas']['sustancias']);
        $this->assertSame('critical', $result['nivel_alerta']);
    }

    public function test_social_alcohol_use_does_not_mark_toxicology_positive_without_exam_result(): void
    {
        $text = <<<'TEXT'
Paciente refiere que bebe alcohol ocasionalmente en reuniones sociales.
Toxicologia: Sin deteccion de alcohol ni drogas de abuso.
TEXT;

        $result = $this->service()->resolve([
            'es_examen_salud' => true,
            'trabajador' => 'Caso Demo',
            'estado_general' => 'apto',
            'imc' => ['valor' => 24.1, 'categoria' => 'Normal', 'alerta' => false, 'critico' => false],
            'drogas' => [
                'detectado' => true,
                'sustancias' => ['alcohol'],
                'alerta' => true,
                'critico' => true,
                'detalle' => 'Paciente refiere que bebe alcohol ocasionalmente. Toxicologia: Sin deteccion de alcohol ni drogas de abuso.',
            ],
            'otros_hallazgos' => [],
            'nivel_alerta' => 'critical',
        ], $text);

        $this->assertFalse($result['drogas']['detectado']);
        $this->assertFalse($result['drogas']['alerta']);
        $this->assertFalse($result['drogas']['critico']);
        $this->assertSame([], $result['drogas']['sustancias']);
        $this->assertSame('clean', $result['nivel_alerta']);
    }

    public function test_lifestyle_alcohol_mention_does_not_keep_false_positive_from_ai_output(): void
    {
        $text = <<<'TEXT'
El trabajador reporta consumo habitual de alcohol.
La evaluacion especifica para altitud geografica concluye que no evidencia alteracion de salud para ejecutar la tarea.
TEXT;

        $result = $this->service()->resolve([
            'es_examen_salud' => true,
            'trabajador' => 'Gonzalo Demo',
            'estado_general' => 'apto',
            'imc' => ['valor' => 30.35, 'categoria' => 'Obesidad I', 'alerta' => true, 'critico' => false],
            'drogas' => [
                'detectado' => true,
                'sustancias' => ['Alcohol'],
                'alerta' => true,
                'critico' => true,
                'detalle' => 'Se reporta consumo habitual o continuo de alcohol.',
            ],
            'otros_hallazgos' => [],
            'nivel_alerta' => 'critical',
        ], $text);

        $this->assertFalse($result['drogas']['detectado']);
        $this->assertFalse($result['drogas']['alerta']);
        $this->assertFalse($result['drogas']['critico']);
        $this->assertSame([], $result['drogas']['sustancias']);
        $this->assertSame('alert', $result['nivel_alerta']);
    }

    public function test_formal_exam_conclusion_apto_overrides_wrong_ai_fitness_inference(): void
    {
        $text = <<<'TEXT'
Conclusión No evidencia alteración de salud para ejecutar la tarea.
IMC 31.92 kg/m2
Creatinina 1.33 mg/dl
Electrocardiograma alterado sin signos de isquemia.
TEXT;

        $result = $this->service()->resolve([
            'es_examen_salud' => true,
            'trabajador' => 'Brian Saravia Ojeda',
            'estado_general' => 'no_apto',
            'imc' => ['valor' => 31.92, 'categoria' => 'Obesidad I', 'alerta' => true, 'critico' => false],
            'drogas' => ['detectado' => false, 'sustancias' => [], 'alerta' => false, 'critico' => false, 'detalle' => 'Sin deteccion'],
            'otros_hallazgos' => [
                ['titulo' => 'Creatinina', 'valor' => '1.33 mg/dl (Alto)', 'alerta' => true],
                ['titulo' => 'Electrocardiograma en Reposo', 'valor' => 'Alterado (Sin signos de isquemia)', 'alerta' => true],
            ],
            'nivel_alerta' => 'alert',
        ], $text);

        $this->assertSame('apto', $result['estado_general']);
        $this->assertSame('alert', $result['nivel_alerta']);
    }

    public function test_usage_payload_marks_cached_analysis_without_usage_metadata(): void
    {
        $usage = $this->service()->usagePayload('notebooklm_source', true);

        $this->assertSame('notebooklm_source', $usage['source']);
        $this->assertTrue($usage['cached']);
        $this->assertSame('ai_load_balancer', $usage['provider']);
        $this->assertFalse($usage['available']);
    }

    public function test_height_exam_category_rejects_other_medical_exam_types(): void
    {
        $result = $this->service()->resolveForCategory([
            'es_examen_salud' => true,
            'tipo_examen' => 'Psicosensotecnico',
            'trabajador' => 'Mario Demo',
            'trabajador_rut' => '18403453-0',
            'nivel_alerta' => 'clean',
        ], 'Examen ocupacional psicosensotecnico.', 'Examen de Altura');

        $this->assertFalse($result['es_examen_salud']);
        $this->assertSame('rejected', $result['nivel_alerta']);
        $this->assertSame('El archivo no corresponde a la categoria Examen de Altura.', $result['motivo_rechazo']);
    }

    public function test_height_exam_category_accepts_preocupational_exam_when_text_explicitly_mentions_altitude(): void
    {
        $result = $this->service()->resolveForCategory([
            'es_examen_salud' => true,
            'tipo_examen' => 'Preocupacional',
            'trabajador' => 'Mario Demo',
            'trabajador_rut' => '18403453-0',
            'nivel_alerta' => 'clean',
            'imc' => ['valor' => null, 'categoria' => 'Sin datos', 'alerta' => false, 'critico' => false],
            'drogas' => ['detectado' => false, 'sustancias' => [], 'alerta' => false, 'critico' => false, 'detalle' => 'Sin deteccion'],
            'otros_hallazgos' => [],
        ], 'De acuerdo a la evaluacion de salud de tipo Preocupacional. Riesgo: Altitud geografica entre 3.000 y 5.500 m.s.n.m. Conclusion: No evidencia alteracion de salud para ejecutar la tarea.', 'Examen de Altura');

        $this->assertTrue($result['es_examen_salud']);
        $this->assertSame('Altitud Geografica', $result['tipo_examen']);
        $this->assertSame('clean', $result['nivel_alerta']);
    }

    public function test_height_exam_category_accepts_occupational_exam_when_text_mentions_gran_altura_geografica(): void
    {
        $result = $this->service()->resolveForCategory([
            'es_examen_salud' => true,
            'tipo_examen' => 'Ocupacional',
            'trabajador' => 'Miguel Demo',
            'trabajador_rut' => '28.382.210-9',
            'nivel_alerta' => 'clean',
            'imc' => ['valor' => null, 'categoria' => 'Sin datos', 'alerta' => false, 'critico' => false],
            'drogas' => ['detectado' => false, 'sustancias' => [], 'alerta' => false, 'critico' => false, 'detalle' => 'Sin deteccion'],
            'otros_hallazgos' => [],
        ], 'OCUPACIONAL GRAN ALTURA GEOGRAFICA (SOBRE LOS 3.000 Y MENOR A 5.500 METROS SOBRE EL NIVEL DEL MAR). Resultado: Apto para el trabajo en altura geografica entre los 3000 y 5500 msnm.', 'Examen de Altura');

        $this->assertTrue($result['es_examen_salud']);
        $this->assertSame('Altitud Geografica', $result['tipo_examen']);
        $this->assertSame('clean', $result['nivel_alerta']);
    }

    public function test_latest_expiry_is_preserved_when_new_document_is_older(): void
    {
        $this->assertSame('2026-12-31', $this->service()->latestExpiry('2026-12-31', '2026-06-30'));
        $this->assertSame('2027-01-15', $this->service()->latestExpiry('2026-12-31', '2027-01-15'));
    }
}
