import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const headers = [
    'Nacionalidad', 'RUT', 'Pasaporte', 'Doc. Identidad Chile',
    'Nombres', 'Ap. Paterno', 'Ap. Materno', 'Fec. Nacimiento', 'Est. Civil',
    'Comuna', 'Dirección', 'Email', 'Teléfono', 'WhatsApp',
    'Nombre Emergencia', 'Teléf. Emergencia',
    'Cód. Banco', 'Tipo Cuenta', 'Nº Cuenta',
    'Dirección Beneficiario (Int)', 'Ciudad Beneficiario', 'Cta. Abono Beneficiario', 'BIC / SWIFT',
    'Cargo', 'Depto.'
];

const sampleData = [
    [
        'Chilena', '12.345.678-9', '', '',
        'Juan Antonio', 'Pérez', 'González', '1985-05-15', 'Casado(a)',
        'Santiago', 'Av. Libertador 123', 'juan.perez@email.com', '+56912345678', '+56912345678',
        'María González', '+56987654321',
        '012', 'Cuenta RUT', '12345678',
        '', '', '', '',
        'Supervisor', 'Operaciones'
    ],
    [
        'Mexicana', '', 'P1234567', '25.345.678-K',
        'Carlos', 'Sánchez', 'Rodríguez', '1992-10-20', 'Soltero(a)',
        'Providencia', 'Calle Falsa 456', 'carlos.s@email.com', '+56922334455', '+56922334455',
        'Elena Rodríguez', '+5215512345678',
        '', '', '',
        'Av. Reforma 10', 'Ciudad de México', 'MX123456789', 'BXMEXMM',
        'Ingeniero', 'TI'
    ]
];

const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla Personal');

const outputPath = path.resolve(__dirname, 'public/plantilla_importacion.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log(`Plantilla generada exitosamente en: ${outputPath}`);
