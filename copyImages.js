import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

// Ścieżka do wypakowanego folderu Kaggle z 44k zdjęć (zmień na swoją!)
// np. 'C:/Users/Tymon/Downloads/fashion-dataset/images'
const SOURCE_DIR = 'C:/Users/tymon/Downloads/archive/fashion-dataset/images';

// Ścieżka do folderu public w Twoim React (zmień na swoją!)
// np. '../frontend/public/images'
const DEST_DIR = 'C:/Users/tymon/source/repos/frontend/public';

async function run() {
    console.log("Łączenie z bazą danych...");
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'user_database',
        port: 3306
    });

    // Pobieramy tylko ID z Twojej tabeli
    const [rows] = await pool.query('SELECT id FROM products');
    console.log(`Znaleziono ${rows.length} produktów w bazie. Rozpoczynam kopiowanie...`);

    // Upewniamy się, że folder docelowy istnieje
    if (!fs.existsSync(DEST_DIR)) {
        fs.mkdirSync(DEST_DIR, { recursive: true });
    }

    let copied = 0;
    let missing = 0;

    // Przechodzimy przez każde ID z bazy
    for (const row of rows) {
        const fileName = `${row.id}.jpg`;
        const srcPath = path.join(SOURCE_DIR, fileName);
        const destPath = path.join(DEST_DIR, fileName);

        // Jeśli plik istnieje w ogromnym folderze, kopiujemy go do Reacta
        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            copied++;
        } else {
            console.log(`Brak pliku: ${fileName}`);
            missing++;
        }
    }

    console.log(`\nZakończono!`);
    console.log(`Skopiowano pomyślnie: ${copied} zdjęć.`);
    console.log(`Nie znaleziono: ${missing} zdjęć.`);
    process.exit();
}

run();