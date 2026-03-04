<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Limpiar caché de permisos
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // --- Permisos granulares ---
        $permissions = [
            // Documentos
            'documents.view',
            'documents.create',
            'documents.delete',
            'documents.analyze',
            'documents.download',
            // Trabajadores
            'workers.view',
            'workers.create',
            'workers.edit',
            'workers.delete',
            // Administración
            'admin.users',
            'admin.audit-logs',
            'admin.settings',
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm]);
        }

        // --- Roles ---

        // Admin: acceso total
        $admin = Role::firstOrCreate(['name' => 'admin']);
        $admin->givePermissionTo(Permission::all());

        // Supervisor: ver, analizar y descargar; NO eliminar
        $supervisor = Role::firstOrCreate(['name' => 'supervisor']);
        $supervisor->givePermissionTo([
            'documents.view', 'documents.create', 'documents.analyze', 'documents.download',
            'workers.view', 'workers.create', 'workers.edit',
            'admin.audit-logs',
        ]);

        // Operador: solo subir documentos y ver trabajadores
        $operador = Role::firstOrCreate(['name' => 'operador']);
        $operador->givePermissionTo([
            'documents.view', 'documents.create',
            'workers.view',
        ]);

        // Auditor: solo lectura + audit logs
        $auditor = Role::firstOrCreate(['name' => 'auditor']);
        $auditor->givePermissionTo([
            'documents.view', 'documents.download',
            'workers.view',
            'admin.audit-logs',
        ]);

        $this->command->info('✅ Roles y permisos creados: admin, supervisor, operador, auditor');

        // Asignar rol admin al primer usuario si existe
        $firstUser = \App\Models\User::first();
        if ($firstUser && !$firstUser->hasRole('admin')) {
            $firstUser->assignRole('admin');
            $this->command->info("✅ Rol 'admin' asignado a: {$firstUser->email}");
        }
    }
}
