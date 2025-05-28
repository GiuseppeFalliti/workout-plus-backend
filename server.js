const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// Configura CORS per accettare tutti i metodi HTTP
app.use(cors({
    origin: ['http://localhost:5173', 'https://workout-plus.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

const port = process.env.PORT || 3000;

app.use(express.json());

// Configurazione PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connessione database
pool.connect((err, client, release) => {
    if (err) {
        console.error('Errore connessione database:', err);
        return;
    }
    console.log('Connesso al database PostgreSQL');
    release();

    // Inizializza il database
    initializeDatabase();
});

// Funzione per inizializzare il database
const initializeDatabase = async () => {
    try {
        // Creazione tabelle
        await pool.query(`
            CREATE TABLE IF NOT EXISTS programs (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                level TEXT NOT NULL,
                type TEXT NOT NULL,
                category TEXT,
                description TEXT NOT NULL
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS workouts (
                id SERIAL PRIMARY KEY,
                program_id INTEGER REFERENCES programs(id),
                name TEXT NOT NULL,
                day_number INTEGER NOT NULL,
                week_number INTEGER NOT NULL
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS exercises (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                video_url TEXT
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS workout_exercises (
                id SERIAL PRIMARY KEY,
                workout_id INTEGER REFERENCES workouts(id),
                exercise_id INTEGER REFERENCES exercises(id),
                sets INTEGER,
                reps TEXT,
                weight TEXT,
                rest_time INTEGER,
                notes TEXT,
                order_index INTEGER
            )
        `);

        console.log('Schema database creato con successo');

        // Inserisci gli esercizi base se non esistono
        await insertExercises();

    } catch (err) {
        console.error('Errore inizializzazione database:', err);
    }
};

// Esercizi base
const sampleExercises = [
    { name: 'Spinte Manubri Panca Inclinata', type: 'Chest' },
    { name: 'Croci Cavi', type: 'Chest' },
    { name: 'Tirate Al Petto', type: 'Deltoidi' },
    { name: 'Alzate laterali', type: 'Deltoidi' },
    { name: 'Hummer Esorcista', type: 'Bicipiti' },
    { name: 'Push Down', type: 'Tricipiti' },
    { name: 'Stacco Rumeno', type: 'Legs' },
    { name: 'Lat Machine triangolo', type: 'Back' },
    { name: 'Puley presa larga', type: 'Back' },
    { name: 'Pullover', type: 'Back' },
    { name: 'Overhead cavi', type: 'Triceps' },
    { name: 'Curl Panca', type: 'Bicipiti' },
    { name: 'Curl Bilancere', type: 'Bicipiti' },
    { name: 'Panca Inclinata 30', type: 'Chest' },
    { name: 'Alzate Lat Panca 45', type: 'Deltoidi' },
    { name: 'Trazioni', type: 'Back' },
    { name: 'Handstand Push Up', type: 'shoulders' },
    { name: 'Muscle-up', type: 'back, triceps' },
    { name: 'Pull-up', type: 'back, biceps' },
    { name: 'Burpees', type: 'Full Body' },
    { name: 'Mountain climber', type: 'Legs, Core' },
    { name: 'Plank', type: 'Core' },
    { name: 'Squat', type: 'Legs' },
    { name: 'Lunges', type: 'Legs' },
    { name: 'Leg Raises', type: 'Core' },
    { name: 'Push Ups', type: 'Chest, Triceps' },
    { name: 'Pull Ups', type: 'Back, Biceps' },
    { name: 'Dips', type: 'Triceps' },
    { name: 'Chin Ups', type: 'Back, Biceps' },
    { name: 'Single Leg Deadlifts', type: 'Legs' },
    { name: 'Wall Sit', type: 'Legs' },
    { name: 'Glute Bridge', type: 'Glutes' },
    { name: 'Russian twists', type: 'Core' },
    { name: 'Bicycle crunches', type: 'Core' },
    { name: 'Flutter kick', type: 'Core' },
    { name: 'Jumping Jacks', type: 'Full Body' },
    { name: 'Box Jumps', type: 'Legs' },
    { name: 'Tuck Jumps', type: 'Legs' },
    { name: 'Jump Rope', type: 'Legs, Cardio' },
    { name: 'Kettlebell Swings', type: 'Full Body' },
    { name: 'Kettlebell Goblet Squats', type: 'Legs' },
    { name: 'Kettlebell Deadlifts', type: 'Full Body' },
    { name: 'Kettlebell Clean and Press', type: 'Full Body' },
    { name: 'Kettlebell Snatch', type: 'Full Body' }
];

// Funzione per inserire gli esercizi
const insertExercises = async () => {
    try {
        for (const exercise of sampleExercises) {
            // Controlla se l'esercizio esiste già
            const existingExercise = await pool.query(
                'SELECT id FROM exercises WHERE name = $1',
                [exercise.name]
            );

            // Se non esiste, inseriscilo
            if (existingExercise.rows.length === 0) {
                await pool.query(
                    'INSERT INTO exercises (name, type) VALUES ($1, $2)',
                    [exercise.name, exercise.type]
                );
                console.log(`Nuovo esercizio aggiunto: ${exercise.name}`);
            }
        }
    } catch (err) {
        console.error('Errore inserimento esercizi:', err);
    }
};

// Endpoint per ottenere tutti i programmi
app.get('/api/programmi', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM programs');
        res.json(result.rows);
    } catch (err) {
        console.error('Errore nel recupero dei programmi:', err);
        res.status(500).json({ error: 'Errore nel recupero dei programmi' });
    }
});

// Endpoint per aggiungere un programma
app.post('/api/programmi', async (req, res) => {
    const { name, level, type, category, description } = req.body;
    try {
        const result = await pool.query(`
            INSERT INTO programs (name, level, type, category, description)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `, [name, level, type, category, description]);

        console.log('Programma inserito con successo');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Errore di inserimento:', err);
        res.status(500).json({ error: 'Errore di inserimento' });
    }
});

// Endpoint per ottenere i dettagli di un programma specifico con i suoi workout
app.get('/api/programmi/:id', async (req, res) => {
    const programId = req.params.id;
    try {
        // Recupera il programma
        const programResult = await pool.query('SELECT * FROM programs WHERE id = $1', [programId]);

        if (programResult.rows.length === 0) {
            return res.status(404).json({ error: 'Programma non trovato' });
        }

        // Recupera tutti i workout del programma
        const workoutsResult = await pool.query(
            'SELECT * FROM workouts WHERE program_id = $1 ORDER BY week_number, day_number',
            [programId]
        );

        const program = programResult.rows[0];
        program.workouts = workoutsResult.rows;

        res.json(program);
    } catch (err) {
        console.error('Errore nel recupero del programma:', err);
        res.status(500).json({ error: 'Errore nel recupero del programma' });
    }
});

// Endpoint per aggiungere un workout a un programma
app.post('/api/programmi/:id/workouts', async (req, res) => {
    const programId = req.params.id;
    const { name, dayNumber, weekNumber } = req.body;

    try {
        const result = await pool.query(`
            INSERT INTO workouts (program_id, name, day_number, week_number)
            VALUES ($1, $2, $3, $4) RETURNING *
        `, [programId, name, dayNumber, weekNumber]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Errore nell\'inserimento del workout:', err);
        res.status(500).json({ error: 'Errore nell\'inserimento del workout' });
    }
});

// Endpoint per ottenere tutti gli esercizi disponibili
app.get('/api/exercises', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM exercises ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error('Errore nel recupero degli esercizi:', err);
        res.status(500).json({ error: 'Errore nel recupero degli esercizi' });
    }
});

// Endpoint per aggiungere un esercizio a un workout
app.post('/api/workouts/:id/exercises', async (req, res) => {
    const workoutId = req.params.id;
    const { exerciseId, sets, reps, weight, restTime, notes, orderIndex } = req.body;

    try {
        const result = await pool.query(`
            INSERT INTO workout_exercises 
            (workout_id, exercise_id, sets, reps, weight, rest_time, notes, order_index)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `, [workoutId, exerciseId, sets, reps, weight, restTime, notes, orderIndex]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Errore nell\'inserimento dell\'esercizio:', err);
        res.status(500).json({ error: 'Errore nell\'inserimento dell\'esercizio' });
    }
});

// Endpoint per ottenere tutti gli esercizi di un workout
app.get('/api/workouts/:id/exercises', async (req, res) => {
    const workoutId = req.params.id;
    try {
        const result = await pool.query(`
            SELECT we.*, e.name as exercise_name, e.type as exercise_type 
            FROM workout_exercises we
            JOIN exercises e ON we.exercise_id = e.id
            WHERE we.workout_id = $1
            ORDER BY we.order_index
        `, [workoutId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Errore nel recupero degli esercizi:', err);
        res.status(500).json({ error: 'Errore nel recupero degli esercizi' });
    }
});

// Endpoint per eliminare un esercizio da un workout
app.delete('/api/workout-exercises/:id', async (req, res) => {
    const exerciseId = req.params.id;

    try {
        const result = await pool.query('DELETE FROM workout_exercises WHERE id = $1', [exerciseId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Esercizio non trovato' });
        }

        res.status(200).json({ message: 'Esercizio eliminato con successo' });
    } catch (err) {
        console.error('Errore nella cancellazione:', err);
        res.status(500).json({ error: 'Errore nella cancellazione dell\'esercizio' });
    }
});

// Modifica un esercizio in un workout
app.put('/api/workouts/:workoutId/exercises/:exerciseId', async (req, res) => {
    const { workoutId, exerciseId } = req.params;
    const { sets, reps, weight, restTime, notes } = req.body;

    try {
        await pool.query(`
            UPDATE workout_exercises 
            SET sets = $1, reps = $2, weight = $3, rest_time = $4, notes = $5
            WHERE workout_id = $6 AND id = $7
        `, [sets, reps, weight, restTime, notes, workoutId, exerciseId]);

        res.json({ message: 'Esercizio aggiornato con successo' });
    } catch (err) {
        console.error('Errore aggiornamento esercizio:', err);
        res.status(500).json({ error: err.message });
    }
});

// Modifica il nome di un workout
app.put('/api/workouts/:workoutId', async (req, res) => {
    const { workoutId } = req.params;
    const { name } = req.body;

    try {
        await pool.query('UPDATE workouts SET name = $1 WHERE id = $2', [name, workoutId]);
        res.json({ message: 'Workout aggiornato con successo' });
    } catch (err) {
        console.error('Errore aggiornamento workout:', err);
        res.status(500).json({ error: err.message });
    }
});

// Elimina un workout/giorno di allenamento
app.delete('/api/workouts/:workoutId', async (req, res) => {
    const { workoutId } = req.params;

    try {
        // Prima eliminiamo tutti gli esercizi associati al workout
        await pool.query('DELETE FROM workout_exercises WHERE workout_id = $1', [workoutId]);

        // Poi eliminiamo il workout stesso
        await pool.query('DELETE FROM workouts WHERE id = $1', [workoutId]);

        res.json({ message: 'Giorno di allenamento eliminato con successo' });
    } catch (err) {
        console.error('Errore eliminazione workout:', err);
        res.status(500).json({ error: err.message });
    }
});

// Elimina un esercizio specifico da un workout
app.delete('/api/workouts/:workoutId/exercises/:exerciseId', async (req, res) => {
    const { workoutId, exerciseId } = req.params;

    try {
        const result = await pool.query(
            'DELETE FROM workout_exercises WHERE workout_id = $1 AND id = $2',
            [workoutId, exerciseId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Esercizio non trovato' });
        }

        res.status(200).json({ message: 'Esercizio eliminato con successo' });
    } catch (err) {
        console.error('Errore eliminazione esercizio:', err);
        res.status(500).json({ error: err.message });
    }
});

// Elimina un programma
app.delete('/api/programmi/:id', async (req, res) => {
    const programId = req.params.id;

    try {
        // Prima elimina gli esercizi dei workout
        await pool.query(`
            DELETE FROM workout_exercises 
            WHERE workout_id IN (SELECT id FROM workouts WHERE program_id = $1)
        `, [programId]);

        // Poi elimina i workout
        await pool.query('DELETE FROM workouts WHERE program_id = $1', [programId]);

        // Infine elimina il programma
        await pool.query('DELETE FROM programs WHERE id = $1', [programId]);

        res.json({ message: 'Program deleted successfully' });
    } catch (err) {
        console.error('Errore eliminazione programma:', err);
        res.status(500).json({ error: err.message });
    }
});

// Gestione errori per connessioni database
process.on('SIGINT', async () => {
    console.log('Chiusura server...');
    await pool.end();
    process.exit(0);
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});