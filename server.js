import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';


const app = express();

// Configura CORS per accettare tutti i metodi HTTP
app.use(cors({
    origin: ['http://localhost:5173', 'https://workout-plus.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

const port = process.env.PORT || 3000;

app.use(express.json());

//creazione database
const db = new sqlite3.Database('database.sqlite',
    (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Connected to the SQLite database.');
    }
);

// Creazione tabelle
db.serialize(() => {
    // Tabella programmi
    db.run(`
        CREATE TABLE IF NOT EXISTS programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        level TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT,
        description TEXT NOT NULL
        )
    `);

    // Tabella workouts (giorni di allenamento)
    db.run(`
        CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id INTEGER,
        name TEXT NOT NULL,
        day_number INTEGER NOT NULL,
        week_number INTEGER NOT NULL,
        FOREIGN KEY(program_id) REFERENCES programs(id)
        )
    `);

    // Tabella exercises (esercizi disponibili)
    db.run(`
        CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        video_url TEXT
        )
    `);

    // Tabella workout_exercises (esercizi assegnati a un workout)
    db.run(`
        CREATE TABLE IF NOT EXISTS workout_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER,
        exercise_id INTEGER,
        sets INTEGER,
        reps TEXT,
        weight TEXT,
        rest_time INTEGER,
        notes TEXT,
        order_index INTEGER,
        FOREIGN KEY(workout_id) REFERENCES workouts(id),
        FOREIGN KEY(exercise_id) REFERENCES exercises(id)
        )
    `);

    console.log('Database schema creato con successo');
});

// Inserimento esercizi
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
    { name: 'Alzate Lat Panca 45',type: 'Deltoidi' },
    { name: 'Trazioni',type: 'Back' },
    { name: 'Flessioni', type: 'Chest, Triceps'},
    { name: 'Dip', type: 'Chest, Triceps'}
];

// Funzione per inserire gli esercizi
const insertExercises = () => {
    // Prima elimina tutti gli esercizi esistenti
    db.run('DELETE FROM exercises', [], (err) => {
        if (err) {
            console.error('Errore nella pulizia degli esercizi:', err);
            return;
        }
        
        // Poi inserisci i nuovi esercizi
        sampleExercises.forEach(exercise => {
            db.run('INSERT INTO exercises (name, type) VALUES (?, ?)',
                [exercise.name, exercise.type], (err) => {
                    if (err) {
                        console.error('Errore nell\'inserimento dell\'esercizio:', err);
                    }
                });
        });
        console.log('Esercizi inseriti con successo');
    });
};

// Inserisci gli esercizi dopo la creazione del database
insertExercises();

//Endpoint per ottenere tutti i programmi
app.get('/api/programmi', (req, res) => {
    db.all('SELECT * FROM programs', [], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero dei programmi:', err);
            res.status(500).json({ error: 'Errore nel recupero dei programmi' });
            return;
        }
        res.json(rows);
    });
});

// Endpoint per aggiungere un programma
app.post('/api/programmi', (req, res) => {
    const { name, level, type, category, description } = req.body;
    db.run(`
        INSERT INTO programs (name, level, type, category, description)
        VALUES (?, ?, ?, ?, ?)
    `, [name, level, type, category, description], function(err) {
        if (err) {
            console.error('Errore di inserimento:', err);
            res.status(500).json({ error: 'Errore di inserimento' });
            return;
        }
        console.log('Programma inserito con successo');
        res.status(201).json({ 
            id: this.lastID,
            name,
            level,
            type,
            category,
            description
        });
    });
});

// Endpoint per ottenere i dettagli di un programma specifico con i suoi workout
app.get('/api/programmi/:id', (req, res) => {
    const programId = req.params.id;
    db.get('SELECT * FROM programs WHERE id = ?', [programId], (err, program) => {
        if (err) {
            res.status(500).json({ error: 'Errore nel recupero del programma' });
            return;
        }
        if (!program) {
            res.status(404).json({ error: 'Programma non trovato' });
            return;
        }
        
        // Recupera tutti i workout del programma
        db.all('SELECT * FROM workouts WHERE program_id = ? ORDER BY week_number, day_number', [programId], (err, workouts) => {
            if (err) {
                res.status(500).json({ error: 'Errore nel recupero dei workout' });
                return;
            }
            res.json({ ...program, workouts });
        });
    });
});

// Endpoint per aggiungere un workout a un programma
app.post('/api/programmi/:id/workouts', (req, res) => {
    const programId = req.params.id;
    const { name, dayNumber, weekNumber } = req.body;
    
    db.run(`
        INSERT INTO workouts (program_id, name, day_number, week_number)
        VALUES (?, ?, ?, ?)
    `, [programId, name, dayNumber, weekNumber], function(err) {
        if (err) {
            res.status(500).json({ error: 'Errore nell\'inserimento del workout' });
            return;
        }
        res.status(201).json({
            id: this.lastID,
            program_id: programId,
            name,
            day_number: dayNumber,
            week_number: weekNumber
        });
    });
});

// Endpoint per ottenere tutti gli esercizi disponibili
app.get('/api/exercises', (req, res) => {
    db.all('SELECT * FROM exercises ORDER BY name', [], (err, exercises) => {
        if (err) {
            res.status(500).json({ error: 'Errore nel recupero degli esercizi' });
            return;
        }
        res.json(exercises);
    });
});

// Endpoint per aggiungere un esercizio a un workout
app.post('/api/workouts/:id/exercises', (req, res) => {
    const workoutId = req.params.id;
    const { exerciseId, sets, reps, weight, restTime, notes, orderIndex } = req.body;
    
    db.run(`
        INSERT INTO workout_exercises 
        (workout_id, exercise_id, sets, reps, weight, rest_time, notes, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [workoutId, exerciseId, sets, reps, weight, restTime, notes, orderIndex], function(err) {
        if (err) {
            res.status(500).json({ error: 'Errore nell\'inserimento dell\'esercizio' });
            return;
        }
        res.status(201).json({
            id: this.lastID,
            workout_id: workoutId,
            exercise_id: exerciseId,
            sets,
            reps,
            weight,
            rest_time: restTime,
            notes,
            order_index: orderIndex
        });
    });
});

// Endpoint per ottenere tutti gli esercizi di un workout
app.get('/api/workouts/:id/exercises', (req, res) => {
    const workoutId = req.params.id;
    db.all(`
        SELECT we.*, e.name as exercise_name, e.type as exercise_type 
        FROM workout_exercises we
        JOIN exercises e ON we.exercise_id = e.id
        WHERE we.workout_id = ?
        ORDER BY we.order_index
    `, [workoutId], (err, exercises) => {
        if (err) {
            res.status(500).json({ error: 'Errore nel recupero degli esercizi' });
            return;
        }
        res.json(exercises);
    });
});

// Endpoint per eliminare un esercizio da un workout
app.delete('/api/workout-exercises/:id', (req, res) => {
    console.log('Ricevuta richiesta DELETE per esercizio:', req.params.id);
    const exerciseId = req.params.id;
    
    db.run('DELETE FROM workout_exercises WHERE id = ?', [exerciseId], function(err) {
        if (err) {
            console.error('Errore nella cancellazione:', err);
            res.status(500).json({ error: 'Errore nella cancellazione dell\'esercizio' });
            return;
        }
        console.log('Risultato cancellazione:', this.changes);
        if (this.changes === 0) {
            res.status(404).json({ error: 'Esercizio non trovato' });
            return;
        }
        res.status(200).json({ message: 'Esercizio eliminato con successo' });
    });
});

// Modifica un esercizio in un workout
app.put('/api/workouts/:workoutId/exercises/:exerciseId', (req, res) => {
    const { workoutId, exerciseId } = req.params;
    const { sets, reps, weight, restTime, notes } = req.body;

    db.run(`
        UPDATE workout_exercises 
        SET sets = ?, reps = ?, weight = ?, rest_time = ?, notes = ?
        WHERE workout_id = ? AND id = ?
    `, [sets, reps, weight, restTime, notes, workoutId, exerciseId], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Esercizio aggiornato con successo' });
    });
});

// Modifica il nome di un workout
app.put('/api/workouts/:workoutId', (req, res) => {
    const { workoutId } = req.params;
    const { name } = req.body;

    db.run('UPDATE workouts SET name = ? WHERE id = ?', [name, workoutId], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Workout aggiornato con successo' });
    });
});

app.delete('/api/workouts/:workoutId/exercises/:exerciseId', (req, res) => {
    const { workoutId, exerciseId } = req.params;
    
    db.run('DELETE FROM workout_exercises WHERE workout_id = ? AND id = ?', [workoutId, exerciseId], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.status(200).json({ message: 'Esercizio eliminato con successo' });
    });
});

// DELETE program endpoint
app.delete('/api/programmi/:id', (req, res) => {
    const programId = req.params.id;
    
    // First delete related workout_exercises
    db.run('DELETE FROM workout_exercises WHERE workout_id IN (SELECT id FROM workouts WHERE program_id = ?)', [programId], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Then delete related workouts
        db.run('DELETE FROM workouts WHERE program_id = ?', [programId], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            // Finally delete the program
            db.run('DELETE FROM programs WHERE id = ?', [programId], (err) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ message: 'Program deleted successfully' });
            });
        });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
