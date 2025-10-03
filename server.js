const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'vbdhotel-secret-key-2023';

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuración de Multer para subida de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});



// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vbdhotel', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ Conectado a MongoDB'))
.catch(err => console.error('❌ Error conectando a MongoDB:', err));

// Esquemas de MongoDB
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: String,
    country: { type: String, default: 'México' },
    avatar: String,
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' }],
    createdAt: { type: Date, default: Date.now }
});

const hotelSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    amenities: [String],
    images: [String],
    videos: [String],
    rating: { type: Number, default: 0 },
    reviews: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: String,
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: String,
        date: { type: Date, default: Date.now }
    }],
    coordinates: {
        lat: Number,
        lng: Number
    },
    city: { type: String, default: 'Reynosa' },
    address: String,
    phone: String,
    email: String,
    createdAt: { type: Date, default: Date.now }
});

const reservationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    checkin: { type: Date, required: true },
    checkout: { type: Date, required: true },
    adults: { type: Number, required: true, min: 1 },
    children: { type: Number, default: 0 },
    roomType: { type: String, required: true },
    total: { type: Number, required: true },
    status: { type: String, default: 'confirmada', enum: ['pendiente', 'confirmada', 'cancelada', 'completada'] },
    pdfUrl: String, // URL del PDF generado
    reservationNumber: String, // Número único de reservación
    createdAt: { type: Date, default: Date.now }
});

// Esquema para configuraciones del sistema
const configSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: mongoose.Schema.Types.Mixed,
    description: String,
    updatedAt: { type: Date, default: Date.now }
});

// Esquema para logs del sistema
const logSchema = new mongoose.Schema({
    level: { type: String, enum: ['info', 'warning', 'error'], required: true },
    message: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: String,
    metadata: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now }
});

// Esquema para destinos
const destinationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    country: { type: String, default: 'México' },
    state: String,
    city: String,
    images: [String],
    coordinates: {
        lat: Number,
        lng: Number
    },
    attractions: [String],
    bestTimeToVisit: String,
    averageTemperature: String,
    currency: { type: String, default: 'MXN' },
    language: { type: String, default: 'Español' },
    timezone: String,
    popularWith: [String], // ['families', 'couples', 'business', 'solo']
    tags: [String],
    createdAt: { type: Date, default: Date.now }
});

// Esquema para experiencias
const experienceSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    category: { type: String, required: true }, // 'adventure', 'cultural', 'gastronomic', 'wellness', 'business'
    location: String,
    duration: String, // '2 hours', '1 day', '3 days'
    price: Number,
    images: [String],
    includes: [String],
    requirements: [String],
    difficulty: { type: String, enum: ['easy', 'moderate', 'challenging'], default: 'easy' },
    maxParticipants: Number,
    minAge: Number,
    rating: { type: Number, default: 0 },
    reviews: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: String,
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: String,
        date: { type: Date, default: Date.now }
    }],
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});


// AGREGAR ESTE ESQUEMA DESPUÉS DEL experienceSchema EN TU server.js

// Esquema para compras de destinos
const destinationPurchaseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userEmail: { type: String, required: true },
    destination: {
        id: Number,
        name: { type: String, required: true },
        category: String,
        location: String,
        description: String,
        image: String,
        coordinates: [Number],
        price: { type: Number, required: true },
        rating: Number,
        schedule: String
    },
    purchaseDetails: {
        quantity: { type: Number, required: true },
        visitDate: { type: Date, required: true },
        visitTime: String,
        visitorName: { type: String, required: true },
        visitorEmail: { type: String, required: true },
        visitorPhone: { type: String, required: true },
        total: { type: Number, required: true }
    },
    status: { type: String, enum: ['confirmada', 'pendiente', 'cancelada', 'completada'], default: 'confirmada' },
    purchaseDate: { type: Date, default: Date.now },
    transactionId: { type: String, unique: true },
    pdfUrl: String
});

// AGREGAR ESTE MODELO DESPUÉS DE LA DEFINICIÓN DE Experience
const DestinationPurchase = mongoose.model('DestinationPurchase', destinationPurchaseSchema);

// AGREGAR ESTAS RUTAS DESPUÉS DE LAS RUTAS DE EXPERIENCIAS

// ======================== RUTAS PARA COMPRAS DE DESTINOS ========================








// Modelos
const User = mongoose.model('User', userSchema);
const Hotel = mongoose.model('Hotel', hotelSchema);
const Reservation = mongoose.model('Reservation', reservationSchema);
const Config = mongoose.model('Config', configSchema);
const Log = mongoose.model('Log', logSchema);
const Destination = mongoose.model('Destination', destinationSchema);
const Experience = mongoose.model('Experience', experienceSchema);

// Función para generar número de reservación único
function generateReservationNumber() {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `VBD-${timestamp.slice(-6)}-${random}`;
}

// Función para crear logs
async function createLog(level, message, userId = null, action = null, metadata = {}) {
    try {
        const log = new Log({
            level,
            message,
            userId,
            action,
            metadata
        });
        await log.save();
    } catch (error) {
        console.error('Error creando log:', error);
    }
}

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
};

// Insertar datos de ejemplo y configuraciones iniciales
async function insertSampleData() {
    try {
        const hotelCount = await Hotel.countDocuments();
        if (hotelCount === 0) {
            const sampleHotels = [
                {
                    name: 'City Express Reynosa',
                    location: 'Blvd. Morelos, Reynosa, Tamaulipas',
                    description: 'Hotel con amenities modernas y ubicación estratégica en Reynosa. Ideal para viajes de negocios y placer.',
                    price: 850,
                    amenities: ['wifi', 'alberca', 'estacionamiento', 'desayuno', 'gimnasio'],
                    images: [
                        'https://images.unsplash.com/photo-1564501049412-61c2a3083791?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
                        'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
                    ],
                    videos: ['https://www.youtube.com/embed/VIDEO_ID_1'],
                    coordinates: { lat: 26.0800, lng: -98.3000 },
                    address: 'Blvd. Morelos 123, Centro, Reynosa, Tamps.',
                    phone: '+52 899 123 4567',
                    email: 'reservaciones@cityexpressreynosa.com'
                },
                {
                    name: 'Holiday Inn Reynosa',
                    location: 'Av. Hidalgo, Reynosa, Tamaulipas',
                    description: 'Hotel de categoría internacional con servicio de primera y amenities exclusivas.',
                    price: 1200,
                    amenities: ['wifi', 'alberca', 'spa', 'restaurante', 'bar', 'room service'],
                    images: [
                        'https://images.unsplash.com/photo-1582719508461-905c673771fd?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
                        'https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
                    ],
                    videos: ['https://www.youtube.com/embed/VIDEO_ID_2'],
                    coordinates: { lat: 26.0600, lng: -98.2900 },
                    address: 'Av. Hidalgo 456, Del Prado, Reynosa, Tamps.',
                    phone: '+52 899 234 5678',
                    email: 'info@holidayinnreynosa.com'
                },
                {
                    name: 'Fiesta Inn Reynosa',
                    location: 'Col. Del Prado, Reynosa, Tamaulipas',
                    description: 'Cadena hotelera reconocida con confort y servicio de calidad para toda la familia.',
                    price: 1100,
                    amenities: ['wifi', 'alberca', 'estacionamiento', 'desayuno buffet', 'centro de negocios'],
                    images: [
                        'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
                        'https://images.unsplash.com/photo-1564501049550-d6c5f2c352d1?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
                    ],
                    videos: ['https://www.youtube.com/embed/VIDEO_ID_3'],
                    coordinates: { lat: 26.0700, lng: -98.3100 },
                    address: 'Periférico 789, Del Prado, Reynosa, Tamps.',
                    phone: '+52 899 345 6789',
                    email: 'reservas@fiestainnreynosa.com'
                },
                {
                    name: 'Best Western Reynosa',
                    location: 'Blvd. Los Virreyes, Reynosa, Tamaulipas',
                    description: 'Hotel con estándares internacionales y atención personalizada para una estancia memorable.',
                    price: 950,
                    amenities: ['wifi', 'alberca', 'gimnasio', 'bar', 'room service', 'business center'],
                    images: [
                        'https://images.unsplash.com/photo-1590490360182-c33d57733427?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
                        'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
                    ],
                    videos: ['https://www.youtube.com/embed/VIDEO_ID_4'],
                    coordinates: { lat: 26.0750, lng: -98.2950 },
                    address: 'Blvd. Los Virreyes 321, Reynosa, Tamps.',
                    phone: '+52 899 456 7890',
                    email: 'contacto@bestwesternreynosa.com'
                },
                {
                    name: 'Hotel San Carlos',
                    location: 'Centro Histórico, Reynosa, Tamaulipas',
                    description: 'Hotel familiar con tradición y servicio cálido en el corazón de Reynosa.',
                    price: 700,
                    amenities: ['wifi', 'estacionamiento', 'restaurante', 'room service'],
                    images: [
                        'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
                        'https://images.unsplash.com/photo-1599619585752-c3f01dd27e2c?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
                    ],
                    videos: ['https://www.youtube.com/embed/VIDEO_ID_5'],
                    coordinates: { lat: 26.0650, lng: -98.3050 },
                    address: 'Calle Juárez 654, Centro, Reynosa, Tamps.',
                    phone: '+52 899 567 8901',
                    email: 'hotelsancarlos@example.com'
                }
            ];
            
            await Hotel.insertMany(sampleHotels);
            await createLog('info', 'Datos de ejemplo insertados correctamente', null, 'system_init');
            console.log('✅ Datos de ejemplo insertados correctamente');
        }

        // Insertar configuraciones iniciales
        const configCount = await Config.countDocuments();
        if (configCount === 0) {
            const initialConfigs = [
                {
                    key: 'site_name',
                    value: 'VBDHOTEL',
                    description: 'Nombre del sitio web'
                },
                {
                    key: 'max_reservation_days',
                    value: 365,
                    description: 'Máximo de días para reservar con anticipación'
                },
                {
                    key: 'cancellation_hours',
                    value: 24,
                    description: 'Horas mínimas para cancelar sin penalización'
                },
                {
                    key: 'email_notifications',
                    value: true,
                    description: 'Enviar notificaciones por email'
                }
            ];
            
            await Config.insertMany(initialConfigs);
            console.log('✅ Configuraciones iniciales creadas');
        }

        // Insertar destinos de ejemplo
        const destinationCount = await Destination.countDocuments();
        if (destinationCount === 0) {
            const sampleDestinations = [
                {
                    name: 'Reynosa, Tamaulipas',
                    description: 'Ciudad fronteriza vibrante con rica historia y excelente ubicación para negocios y turismo.',
                    country: 'México',
                    state: 'Tamaulipas',
                    city: 'Reynosa',
                    images: [
                        'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
                        'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
                    ],
                    coordinates: { lat: 26.0800, lng: -98.3000 },
                    attractions: ['Plaza Principal', 'Puente Internacional', 'Mercado Juárez', 'Museo de Historia'],
                    bestTimeToVisit: 'Octubre a Marzo',
                    averageTemperature: '22°C - 35°C',
                    popularWith: ['business', 'families'],
                    tags: ['frontera', 'negocios', 'comercio']
                },
                {
                    name: 'Matamoros, Tamaulipas',
                    description: 'Puerto histórico con arquitectura colonial y tradiciones culturales únicas.',
                    country: 'México',
                    state: 'Tamaulipas',
                    city: 'Matamoros',
                    images: [
                        'https://images.unsplash.com/photo-1518638150340-f706e86654de?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
                    ],
                    coordinates: { lat: 25.8756, lng: -97.5047 },
                    attractions: ['Centro Histórico', 'Teatro Reforma', 'Casa Mata', 'Playa Bagdad'],
                    bestTimeToVisit: 'Noviembre a Abril',
                    averageTemperature: '20°C - 32°C',
                    popularWith: ['cultural', 'families'],
                    tags: ['historia', 'cultura', 'playa']
                },
                {
                    name: 'Tampico, Tamaulipas',
                    description: 'Puerto petrolero con hermosas playas y arquitectura art déco.',
                    country: 'México',
                    state: 'Tamaulipas',
                    city: 'Tampico',
                    images: [
                        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
                    ],
                    coordinates: { lat: 22.2666, lng: -97.8667 },
                    attractions: ['Playa Miramar', 'Centro Histórico', 'Laguna del Carpintero', 'Museo de la Cultura Huasteca'],
                    bestTimeToVisit: 'Diciembre a Mayo',
                    averageTemperature: '25°C - 38°C',
                    popularWith: ['beach', 'families', 'couples'],
                    tags: ['playa', 'petróleo', 'arquitectura']
                }
            ];

            await Destination.insertMany(sampleDestinations);
            console.log('✅ Destinos de ejemplo insertados');
        }

        // Insertar experiencias de ejemplo
        const experienceCount = await Experience.countDocuments();
        if (experienceCount === 0) {
            const sampleExperiences = [
                {
                    title: 'Tour Gastronómico por Reynosa',
                    description: 'Descubre los sabores auténticos de la frontera con un recorrido por los mejores restaurantes locales.',
                    category: 'gastronomic',
                    location: 'Reynosa, Tamaulipas',
                    duration: '4 horas',
                    price: 850,
                    images: [
                        'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
                    ],
                    includes: ['Guía especializado', 'Comida en 5 restaurantes', 'Transporte'],
                    requirements: ['Identificación oficial'],
                    difficulty: 'easy',
                    maxParticipants: 12,
                    minAge: 12,
                    rating: 4.5
                },
                {
                    title: 'Aventura en Río Bravo',
                    description: 'Experiencia de rafting y pesca en las aguas del Río Bravo con guías expertos.',
                    category: 'adventure',
                    location: 'Río Bravo, Reynosa',
                    duration: '6 horas',
                    price: 1200,
                    images: [
                        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
                    ],
                    includes: ['Equipo de seguridad', 'Guía certificado', 'Almuerzo', 'Transporte'],
                    requirements: ['Saber nadar', 'Estado físico básico'],
                    difficulty: 'moderate',
                    maxParticipants: 8,
                    minAge: 16,
                    rating: 4.7
                },
                {
                    title: 'Centro Histórico y Cultura Local',
                    description: 'Recorrido cultural por los sitios más emblemáticos de Reynosa y su rica historia fronteriza.',
                    category: 'cultural',
                    location: 'Centro de Reynosa',
                    duration: '3 horas',
                    price: 450,
                    images: [
                        'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
                    ],
                    includes: ['Guía cultural', 'Entradas a museos', 'Degustación tradicional'],
                    requirements: ['Ninguno'],
                    difficulty: 'easy',
                    maxParticipants: 20,
                    minAge: 8,
                    rating: 4.2
                },
                {
                    title: 'Spa y Relajación Fronteriza',
                    description: 'Experiencia de wellness con tratamientos tradicionales y modernos en el mejor spa de la región.',
                    category: 'wellness',
                    location: 'Hotel Spa Reynosa',
                    duration: '5 horas',
                    price: 1800,
                    images: [
                        'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
                    ],
                    includes: ['Masaje completo', 'Facial', 'Acceso a instalaciones', 'Refrigerios'],
                    requirements: ['Reserva con 24h de anticipación'],
                    difficulty: 'easy',
                    maxParticipants: 6,
                    minAge: 18,
                    rating: 4.8
                },
                {
                    title: 'Tour de Negocios y Networking',
                    description: 'Recorrido por las principales zonas comerciales e industriales con oportunidades de networking.',
                    category: 'business',
                    location: 'Zona Industrial Reynosa',
                    duration: '8 horas',
                    price: 2500,
                    images: [
                        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
                    ],
                    includes: ['Transporte ejecutivo', 'Almuerzo de negocios', 'Traductor', 'Material informativo'],
                    requirements: ['Vestimenta formal', 'Identificación oficial'],
                    difficulty: 'easy',
                    maxParticipants: 15,
                    minAge: 21,
                    rating: 4.4
                }
            ];

            await Experience.insertMany(sampleExperiences);
            console.log('✅ Experiencias de ejemplo insertadas');
        }

    } catch (error) {
        console.error('❌ Error insertando datos de ejemplo:', error);
        await createLog('error', 'Error insertando datos de ejemplo', null, 'system_init', { error: error.message });
    }
}

// RUTAS DE LA API

// Registro de usuario
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, phone, country } = req.body;
        
        // Validar campos requeridos
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
        }
        
        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            await createLog('warning', 'Intento de registro con email existente', null, 'register_attempt', { email });
            return res.status(400).json({ error: 'El usuario ya existe' });
        }
        
        // Hash de la contraseña
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Crear nuevo usuario
        const user = new User({
            name,
            email,
            password: hashedPassword,
            phone,
            country: country || 'México'
        });
        
        await user.save();
        
        // Generar token JWT
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        await createLog('info', 'Usuario registrado exitosamente', user._id, 'user_register');
        
        res.status(201).json({
            message: 'Usuario creado exitosamente',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                country: user.country
            }
        });
    } catch (error) {
        await createLog('error', 'Error en registro de usuario', null, 'user_register', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Login de usuario
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validar campos requeridos
        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }
        
        // Verificar si el usuario existe
        const user = await User.findOne({ email });
        if (!user) {
            await createLog('warning', 'Intento de login con email inexistente', null, 'login_attempt', { email });
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }
        
        // Verificar contraseña
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            await createLog('warning', 'Intento de login con contraseña incorrecta', user._id, 'login_attempt');
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }
        
        // Generar token JWT
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        await createLog('info', 'Login exitoso', user._id, 'user_login');
        
        res.json({
            message: 'Login exitoso',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                country: user.country
            }
        });
    } catch (error) {
        await createLog('error', 'Error en login', null, 'user_login', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Obtener perfil de usuario
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(user);
    } catch (error) {
        await createLog('error', 'Error obteniendo perfil', req.user?.userId, 'get_profile', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Actualizar perfil de usuario
app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { name, phone, country } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { name, phone, country },
            { new: true }
        ).select('-password');
        
        await createLog('info', 'Perfil actualizado', req.user.userId, 'update_profile');
        
        res.json({ message: 'Perfil actualizado', user });
    } catch (error) {
        await createLog('error', 'Error actualizando perfil', req.user?.userId, 'update_profile', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Subir avatar de usuario
app.post('/api/profile/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se seleccionó ningún archivo' });
        }

        const avatarUrl = `/uploads/${req.file.filename}`;
        
        await User.findByIdAndUpdate(req.user.userId, { avatar: avatarUrl });
        
        await createLog('info', 'Avatar actualizado', req.user.userId, 'update_avatar');
        
        res.json({ message: 'Avatar actualizado', avatarUrl });
    } catch (error) {
        await createLog('error', 'Error subiendo avatar', req.user?.userId, 'update_avatar', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Obtener todos los hoteles
app.get('/api/hotels', async (req, res) => {
    try {
        const { page = 1, limit = 10, search, minPrice, maxPrice, amenities, city } = req.query;
        const query = {};
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseInt(minPrice);
            if (maxPrice) query.price.$lte = parseInt(maxPrice);
        }
        
        if (amenities) {
            query.amenities = { $all: amenities.split(',') };
        }
        
        if (city) {
            query.city = { $regex: city, $options: 'i' };
        }
        
        const hotels = await Hotel.find(query)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ rating: -1, createdAt: -1 });
            
        const total = await Hotel.countDocuments(query);
        
        res.json({
            hotels,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        await createLog('error', 'Error obteniendo hoteles', null, 'get_hotels', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Obtener un hotel por ID
app.get('/api/hotels/:id', async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.id).populate('reviews.userId', 'name');
        if (!hotel) {
            return res.status(404).json({ error: 'Hotel no encontrado' });
        }
        res.json(hotel);
    } catch (error) {
        await createLog('error', 'Error obteniendo hotel', null, 'get_hotel', { error: error.message, hotelId: req.params.id });
        res.status(500).json({ error: error.message });
    }
});

// Agregar una reseña a un hotel
app.post('/api/hotels/:id/reviews', authenticateToken, async (req, res) => {
    try {
        const { rating, comment } = req.body;
        
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'El rating debe estar entre 1 y 5' });
        }
        
        const hotel = await Hotel.findById(req.params.id);
        if (!hotel) {
            return res.status(404).json({ error: 'Hotel no encontrado' });
        }
        
        // Verificar si el usuario ya hizo una reseña para este hotel
        const existingReview = hotel.reviews.find(
            review => review.userId.toString() === req.user.userId
        );
        
        if (existingReview) {
            return res.status(400).json({ error: 'Ya has hecho una reseña para este hotel' });
        }
        
        // Obtener información del usuario
        const user = await User.findById(req.user.userId);
        
        // Agregar la reseña
        hotel.reviews.push({
            userId: req.user.userId,
            userName: user.name,
            rating,
            comment
        });
        
        // Recalcular el rating promedio
        const totalRating = hotel.reviews.reduce((sum, review) => sum + review.rating, 0);
        hotel.rating = Math.round((totalRating / hotel.reviews.length) * 10) / 10;
        
        await hotel.save();
        
        await createLog('info', 'Reseña agregada', req.user.userId, 'add_review', { hotelId: req.params.id, rating });
        
        res.json({ message: 'Reseña agregada exitosamente', hotel });
    } catch (error) {
        await createLog('error', 'Error agregando reseña', req.user?.userId, 'add_review', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Crear una reservación
app.post('/api/reservations', authenticateToken, async (req, res) => {
    try {
        const { hotelId, checkin, checkout, adults, children, roomType } = req.body;
        
        // Validar campos requeridos
        if (!hotelId || !checkin || !checkout || !adults || !roomType) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }
        
        // Validar fechas
        const checkinDate = new Date(checkin);
        const checkoutDate = new Date(checkout);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (checkinDate < today) {
            return res.status(400).json({ error: 'La fecha de check-in no puede ser anterior a hoy' });
        }
        
        if (checkoutDate <= checkinDate) {
            return res.status(400).json({ error: 'La fecha de check-out debe ser posterior al check-in' });
        }
        
        // Obtener información del hotel para calcular el total
        const hotel = await Hotel.findById(hotelId);
        if (!hotel) {
            return res.status(404).json({ error: 'Hotel no encontrado' });
        }
        
        // Calcular número de noches
        const nights = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));
        const total = hotel.price * nights;
        
        // Generar número de reservación
        const reservationNumber = generateReservationNumber();
        
        // Crear la reservación
        const reservation = new Reservation({
            userId: req.user.userId,
            hotelId,
            checkin: checkinDate,
            checkout: checkoutDate,
            adults,
            children: children || 0,
            roomType,
            total,
            reservationNumber
        });
        
        await reservation.save();
        
        // Obtener información del usuario
        const user = await User.findById(req.user.userId);
        
        // Crear PDF de confirmación
        const doc = new PDFDocument();
        let filename = `reservation_${reservation._id}.pdf`;
        const filePath = `./uploads/${filename}`;
        
        doc.pipe(fs.createWriteStream(filePath));
        
        // Contenido del PDF
        doc.fontSize(20).text('Confirmación de Reservación - VBDHOTEL', { align: 'center' });
        doc.moveDown();
        doc.fontSize(14);
        doc.text(`Número de Reservación: ${reservationNumber}`, { align: 'center' });
        doc.moveDown();
        
        doc.text(`Hotel: ${hotel.name}`);
        doc.text(`Ubicación: ${hotel.location}`);
        doc.text(`Dirección: ${hotel.address}`);
        doc.moveDown();
        
        doc.text(`Huésped: ${user.name}`);
        doc.text(`Email: ${user.email}`);
        doc.text(`Teléfono: ${user.phone || 'No proporcionado'}`);
        doc.moveDown();
        
        doc.text(`Fecha de llegada: ${checkinDate.toLocaleDateString('es-MX')}`);
        doc.text(`Fecha de salida: ${checkoutDate.toLocaleDateString('es-MX')}`);
        doc.text(`Noches: ${nights}`);
        doc.text(`Huéspedes: ${adults} adultos${children ? `, ${children} niños` : ''}`);
        doc.text(`Tipo de habitación: ${roomType}`);
        doc.moveDown();
        
        doc.fontSize(16).text(`Total: $${total.toLocaleString()} MXN`, { align: 'right' });
        doc.fontSize(14).text(`Estado: ${reservation.status}`);
        doc.moveDown();
        
        doc.text('¡Gracias por elegir VBDHOTEL!', { align: 'center' });
        doc.text('Esperamos que disfrutes tu estancia', { align: 'center' });
        
        doc.end();
        
        // Actualizar reservación con URL del PDF
        reservation.pdfUrl = `/uploads/${filename}`;
        await reservation.save();
        
        // Enviar correo con confirmación (si está configurado)
        try {
            const emailConfig = await Config.findOne({ key: 'email_notifications' });
            if (emailConfig && emailConfig.value) {
                const mailOptions = {
                    from: 'VBDHOTEL <no-reply@vbdhotel.com>',
                    to: user.email,
                    subject: `Confirmación de Reservación ${reservationNumber} - VBDHOTEL`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h1 style="color: #2c5aa0;">Confirmación de Reservación</h1>
                            <p>Hola ${user.name},</p>
                            <p>Tu reservación en <strong>${hotel.name}</strong> ha sido confirmada.</p>
                            
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                <h3>Detalles de la reservación:</h3>
                                <ul style="list-style: none; padding: 0;">
                                    <li><strong>Número de Reservación:</strong> ${reservationNumber}</li>
                                    <li><strong>Hotel:</strong> ${hotel.name}</li>
                                    <li><strong>Ubicación:</strong> ${hotel.location}</li>
                                    <li><strong>Dirección:</strong> ${hotel.address}</li>
                                    <li><strong>Check-in:</strong> ${checkinDate.toLocaleDateString('es-MX')}</li>
                                    <li><strong>Check-out:</strong> ${checkoutDate.toLocaleDateString('es-MX')}</li>
                                    <li><strong>Noches:</strong> ${nights}</li>
                                    <li><strong>Huéspedes:</strong> ${adults} adultos${children ? `, ${children} niños` : ''}</li>
                                    <li><strong>Tipo de habitación:</strong> ${roomType}</li>
                                    <li><strong>Total:</strong> ${total.toLocaleString()} MXN</li>
                                    <li><strong>Estado:</strong> ${reservation.status}</li>
                                </ul>
                            </div>
                            
                            <p><strong>Información de contacto del hotel:</strong></p>
                            <p>Teléfono: ${hotel.phone}<br>
                            Email: ${hotel.email}</p>
                            
                            <p>¡Esperamos que disfrutes tu estancia!</p>
                            <p>Atentamente,<br><strong>El equipo de VBDHOTEL</strong></p>
                        </div>
                    `,
                    attachments: [
                        {
                            filename: `reservacion_${reservationNumber}.pdf`,
                            path: filePath
                        }
                    ]
                };
                
                await transporter.sendMail(mailOptions);
                await createLog('info', 'Email de confirmación enviado', req.user.userId, 'email_sent', { reservationId: reservation._id });
            }
        } catch (emailError) {
            await createLog('error', 'Error enviando email de confirmación', req.user.userId, 'email_error', { error: emailError.message });
            console.error('Error enviando email:', emailError);
        }
        
        await createLog('info', 'Reservación creada exitosamente', req.user.userId, 'create_reservation', { reservationId: reservation._id });
        
        res.status(201).json({
            message: 'Reservación creada exitosamente',
            reservation: {
                ...reservation.toObject(),
                hotel: {
                    name: hotel.name,
                    location: hotel.location,
                    images: hotel.images
                }
            },
            pdfUrl: `/uploads/${filename}`
        });
    } catch (error) {
        await createLog('error', 'Error creando reservación', req.user?.userId, 'create_reservation', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Obtener reservaciones de un usuario
app.get('/api/reservations', authenticateToken, async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const query = { userId: req.user.userId };
        
        if (status) {
            query.status = status;
        }
        
        const reservations = await Reservation.find(query)
            .populate('hotelId', 'name location images price phone email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
            
        const total = await Reservation.countDocuments(query);
        
        res.json({
            reservations,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        await createLog('error', 'Error obteniendo reservaciones', req.user?.userId, 'get_reservations', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Obtener una reservación específica
app.get('/api/reservations/:id', authenticateToken, async (req, res) => {
    try {
        const reservation = await Reservation.findOne({
            _id: req.params.id,
            userId: req.user.userId
        }).populate('hotelId', 'name location images price phone email address');
        
        if (!reservation) {
            return res.status(404).json({ error: 'Reservación no encontrada' });
        }
        
        res.json(reservation);
    } catch (error) {
        await createLog('error', 'Error obteniendo reservación', req.user?.userId, 'get_reservation', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Cancelar una reservación
app.put('/api/reservations/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const reservation = await Reservation.findOne({
            _id: req.params.id,
            userId: req.user.userId
        }).populate('hotelId', 'name location phone email');
        
        if (!reservation) {
            return res.status(404).json({ error: 'Reservación no encontrada' });
        }
        
        // Solo se pueden cancelar reservaciones pendientes o confirmadas
        if (reservation.status === 'cancelada') {
            return res.status(400).json({ error: 'La reservación ya está cancelada' });
        }
        
        if (reservation.status === 'completada') {
            return res.status(400).json({ error: 'No se puede cancelar una reservación completada' });
        }
        
        // Verificar política de cancelación (24 horas antes)
        const cancellationConfig = await Config.findOne({ key: 'cancellation_hours' });
        const cancellationHours = cancellationConfig ? cancellationConfig.value : 24;
        
        const now = new Date();
        const checkinTime = new Date(reservation.checkin);
        const hoursUntilCheckin = (checkinTime - now) / (1000 * 60 * 60);
        
        if (hoursUntilCheckin < cancellationHours) {
            return res.status(400).json({ 
                error: `No se puede cancelar. Debe hacerlo con al menos ${cancellationHours} horas de anticipación` 
            });
        }
        
        reservation.status = 'cancelada';
        await reservation.save();
        
        // Obtener información del usuario
        const user = await User.findById(req.user.userId);
        
        // Enviar email de cancelación
        try {
            const emailConfig = await Config.findOne({ key: 'email_notifications' });
            if (emailConfig && emailConfig.value) {
                const mailOptions = {
                    from: 'VBDHOTEL <no-reply@vbdhotel.com>',
                    to: user.email,
                    subject: `Cancelación de Reservación ${reservation.reservationNumber} - VBDHOTEL`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h1 style="color: #dc3545;">Cancelación de Reservación</h1>
                            <p>Hola ${user.name},</p>
                            <p>Tu reservación en <strong>${reservation.hotelId.name}</strong> ha sido cancelada exitosamente.</p>
                            
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                <h3>Detalles de la reservación cancelada:</h3>
                                <ul style="list-style: none; padding: 0;">
                                    <li><strong>Número de Reservación:</strong> ${reservation.reservationNumber}</li>
                                    <li><strong>Hotel:</strong> ${reservation.hotelId.name}</li>
                                    <li><strong>Check-in:</strong> ${new Date(reservation.checkin).toLocaleDateString('es-MX')}</li>
                                    <li><strong>Check-out:</strong> ${new Date(reservation.checkout).toLocaleDateString('es-MX')}</li>
                                    <li><strong>Huéspedes:</strong> ${reservation.adults} adultos${reservation.children ? `, ${reservation.children} niños` : ''}</li>
                                    <li><strong>Tipo de habitación:</strong> ${reservation.roomType}</li>
                                    <li><strong>Total:</strong> ${reservation.total.toLocaleString()} MXN</li>
                                </ul>
                            </div>
                            
                            <p>El reembolso será procesado en los próximos 5-7 días hábiles.</p>
                            <p>Esperamos verte pronto en otra ocasión.</p>
                            <p>Atentamente,<br><strong>El equipo de VBDHOTEL</strong></p>
                        </div>
                    `
                };
                
                await transporter.sendMail(mailOptions);
                await createLog('info', 'Email de cancelación enviado', req.user.userId, 'email_sent', { reservationId: reservation._id });
            }
        } catch (emailError) {
            await createLog('error', 'Error enviando email de cancelación', req.user.userId, 'email_error', { error: emailError.message });
            console.error('Error enviando email de cancelación:', emailError);
        }
        
        await createLog('info', 'Reservación cancelada', req.user.userId, 'cancel_reservation', { reservationId: reservation._id });
        
        res.json({ message: 'Reservación cancelada exitosamente', reservation });
    } catch (error) {
        await createLog('error', 'Error cancelando reservación', req.user?.userId, 'cancel_reservation', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Agregar hotel a favoritos
app.post('/api/favorites/:hotelId', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        const hotel = await Hotel.findById(req.params.hotelId);
        
        if (!hotel) {
            return res.status(404).json({ error: 'Hotel no encontrado' });
        }
        
        if (user.favorites.includes(req.params.hotelId)) {
            return res.status(400).json({ error: 'El hotel ya está en favoritos' });
        }
        
        user.favorites.push(req.params.hotelId);
        await user.save();
        
        await createLog('info', 'Hotel agregado a favoritos', req.user.userId, 'add_favorite', { hotelId: req.params.hotelId });
        
        res.json({ message: 'Hotel agregado a favoritos', favorites: user.favorites });
    } catch (error) {
        await createLog('error', 'Error agregando a favoritos', req.user?.userId, 'add_favorite', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Remover hotel de favoritos
app.delete('/api/favorites/:hotelId', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        
        const initialLength = user.favorites.length;
        user.favorites = user.favorites.filter(
            fav => fav.toString() !== req.params.hotelId
        );
        
        if (user.favorites.length === initialLength) {
            return res.status(400).json({ error: 'El hotel no está en favoritos' });
        }
        
        await user.save();
        
        await createLog('info', 'Hotel removido de favoritos', req.user.userId, 'remove_favorite', { hotelId: req.params.hotelId });
        
        res.json({ message: 'Hotel removido de favoritos', favorites: user.favorites });
    } catch (error) {
        await createLog('error', 'Error removiendo de favoritos', req.user?.userId, 'remove_favorite', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Obtener hoteles favoritos
app.get('/api/favorites', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).populate('favorites');
        res.json(user.favorites);
    } catch (error) {
        await createLog('error', 'Error obteniendo favoritos', req.user?.userId, 'get_favorites', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Obtener estadísticas del dashboard (solo para admin)
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalHotels = await Hotel.countDocuments();
        const totalReservations = await Reservation.countDocuments();
        const totalRevenue = await Reservation.aggregate([
            { $match: { status: { $in: ['confirmada', 'completada'] } } },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]);

        const recentReservations = await Reservation.find()
            .populate('userId', 'name email')
            .populate('hotelId', 'name')
            .sort({ createdAt: -1 })
            .limit(10);

        res.json({
            totalUsers,
            totalHotels,
            totalReservations,
            totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
            recentReservations
        });
    } catch (error) {
        await createLog('error', 'Error obteniendo estadísticas', req.user?.userId, 'get_stats', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Obtener configuraciones
app.get('/api/config', async (req, res) => {
    try {
        const configs = await Config.find();
        const configObj = {};
        configs.forEach(config => {
            configObj[config.key] = config.value;
        });
        res.json(configObj);
    } catch (error) {
        await createLog('error', 'Error obteniendo configuraciones', null, 'get_config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Actualizar configuración (solo para admin)
app.put('/api/config/:key', authenticateToken, async (req, res) => {
    try {
        const { value } = req.body;
        const config = await Config.findOneAndUpdate(
            { key: req.params.key },
            { value, updatedAt: new Date() },
            { new: true, upsert: true }
        );
        
        await createLog('info', 'Configuración actualizada', req.user.userId, 'update_config', { key: req.params.key });
        
        res.json({ message: 'Configuración actualizada', config });
    } catch (error) {
        await createLog('error', 'Error actualizando configuración', req.user?.userId, 'update_config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Obtener logs del sistema
app.get('/api/logs', authenticateToken, async (req, res) => {
    try {
        const { level, page = 1, limit = 50 } = req.query;
        const query = {};
        
        if (level) {
            query.level = level;
        }
        
        const logs = await Log.find(query)
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
            
        const total = await Log.countDocuments(query);
        
        res.json({
            logs,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        await createLog('error', 'Error obteniendo logs', req.user?.userId, 'get_logs', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Verificar disponibilidad de hotel
app.post('/api/hotels/:id/check-availability', async (req, res) => {
    try {
        const { checkin, checkout } = req.body;
        
        if (!checkin || !checkout) {
            return res.status(400).json({ error: 'Fechas de check-in y check-out son requeridas' });
        }
        
        const checkinDate = new Date(checkin);
        const checkoutDate = new Date(checkout);
        
        if (checkoutDate <= checkinDate) {
            return res.status(400).json({ error: 'La fecha de check-out debe ser posterior al check-in' });
        }
        
        // Buscar reservaciones existentes que se solapen con las fechas solicitadas
        const overlappingReservations = await Reservation.find({
            hotelId: req.params.id,
            status: { $in: ['confirmada', 'pendiente'] },
            $or: [
                { checkin: { $lt: checkoutDate }, checkout: { $gt: checkinDate } }
            ]
        });
        
        // Por simplicidad, asumimos que el hotel tiene disponibilidad limitada
        // En un sistema real, esto dependería del inventario de habitaciones
        const maxRooms = 20; // Asumiendo 20 habitaciones por hotel
        const bookedRooms = overlappingReservations.length;
        const availableRooms = maxRooms - bookedRooms;
        
        res.json({
            available: availableRooms > 0,
            availableRooms,
            totalRooms: maxRooms,
            bookedRooms
        });
    } catch (error) {
        await createLog('error', 'Error verificando disponibilidad', null, 'check_availability', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Buscar hoteles por ubicación (para mapas)
app.get('/api/hotels/nearby', async (req, res) => {
    try {
        const { lat, lng, radius = 50 } = req.query; // radius en km
        
        if (!lat || !lng) {
            return res.status(400).json({ error: 'Latitud y longitud son requeridas' });
        }
        
        // Búsqueda geoespacial simple (en una implementación real usarías índices geoespaciales)
        const hotels = await Hotel.find({
            'coordinates.lat': {
                $gte: parseFloat(lat) - radius / 111, // Aproximadamente 111 km por grado
                $lte: parseFloat(lat) + radius / 111
            },
            'coordinates.lng': {
                $gte: parseFloat(lng) - radius / 111,
                $lte: parseFloat(lng) + radius / 111
            }
        }).limit(50);
        
        res.json(hotels);
    } catch (error) {
        await createLog('error', 'Error buscando hoteles cercanos', null, 'nearby_hotels', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// RUTAS PARA DESTINOS

// Obtener todos los destinos
app.get('/api/destinations', async (req, res) => {
    try {
        const { page = 1, limit = 10, search, country, state } = req.query;
        const query = {};
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { attractions: { $in: [new RegExp(search, 'i')] } }
            ];
        }
        
        if (country) {
            query.country = { $regex: country, $options: 'i' };
        }
        
        if (state) {
            query.state = { $regex: state, $options: 'i' };
        }
        
        const destinations = await Destination.find(query)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });
            
        const total = await Destination.countDocuments(query);
        
        res.json({
            destinations,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        await createLog('error', 'Error obteniendo destinos', null, 'get_destinations', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Obtener un destino por ID
app.get('/api/destinations/:id', async (req, res) => {
    try {
        const destination = await Destination.findById(req.params.id);
        if (!destination) {
            return res.status(404).json({ error: 'Destino no encontrado' });
        }
        res.json(destination);
    } catch (error) {
        await createLog('error', 'Error obteniendo destino', null, 'get_destination', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Crear destino (admin)
app.post('/api/destinations', authenticateToken, async (req, res) => {
    try {
        const destination = new Destination(req.body);
        await destination.save();
        
        await createLog('info', 'Destino creado', req.user.userId, 'create_destination', { destinationId: destination._id });
        
        res.status(201).json({ message: 'Destino creado exitosamente', destination });
    } catch (error) {
        await createLog('error', 'Error creando destino', req.user?.userId, 'create_destination', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Actualizar destino (admin)
app.put('/api/destinations/:id', authenticateToken, async (req, res) => {
    try {
        const destination = await Destination.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        
        if (!destination) {
            return res.status(404).json({ error: 'Destino no encontrado' });
        }
        
        await createLog('info', 'Destino actualizado', req.user.userId, 'update_destination', { destinationId: destination._id });
        
        res.json({ message: 'Destino actualizado exitosamente', destination });
    } catch (error) {
        await createLog('error', 'Error actualizando destino', req.user?.userId, 'update_destination', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Eliminar destino (admin)
app.delete('/api/destinations/:id', authenticateToken, async (req, res) => {
    try {
        const destination = await Destination.findByIdAndDelete(req.params.id);
        
        if (!destination) {
            return res.status(404).json({ error: 'Destino no encontrado' });
        }
        
        await createLog('info', 'Destino eliminado', req.user.userId, 'delete_destination', { destinationId: req.params.id });
        
        res.json({ message: 'Destino eliminado exitosamente' });
    } catch (error) {
        await createLog('error', 'Error eliminando destino', req.user?.userId, 'delete_destination', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// RUTAS PARA EXPERIENCIAS

// Obtener todas las experiencias
app.get('/api/experiences', async (req, res) => {
    try {
        const { page = 1, limit = 10, search, category, minPrice, maxPrice, location } = req.query;
        const query = { isActive: true };
        
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (category) {
            query.category = category;
        }
        
        if (location) {
            query.location = { $regex: location, $options: 'i' };
        }
        
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseInt(minPrice);
            if (maxPrice) query.price.$lte = parseInt(maxPrice);
        }
        
        const experiences = await Experience.find(query)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ rating: -1, createdAt: -1 });
            
        const total = await Experience.countDocuments(query);
        
        res.json({
            experiences,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        await createLog('error', 'Error obteniendo experiencias', null, 'get_experiences', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Obtener una experiencia por ID
app.get('/api/experiences/:id', async (req, res) => {
    try {
        const experience = await Experience.findById(req.params.id).populate('reviews.userId', 'name');
        if (!experience) {
            return res.status(404).json({ error: 'Experiencia no encontrada' });
        }
        res.json(experience);
    } catch (error) {
        await createLog('error', 'Error obteniendo experiencia', null, 'get_experience', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Crear experiencia (admin)
app.post('/api/experiences', authenticateToken, async (req, res) => {
    try {
        const experience = new Experience(req.body);
        await experience.save();
        
        await createLog('info', 'Experiencia creada', req.user.userId, 'create_experience', { experienceId: experience._id });
        
        res.status(201).json({ message: 'Experiencia creada exitosamente', experience });
    } catch (error) {
        await createLog('error', 'Error creando experiencia', req.user?.userId, 'create_experience', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Actualizar experiencia (admin)
app.put('/api/experiences/:id', authenticateToken, async (req, res) => {
    try {
        const experience = await Experience.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        
        if (!experience) {
            return res.status(404).json({ error: 'Experiencia no encontrada' });
        }
        
        await createLog('info', 'Experiencia actualizada', req.user.userId, 'update_experience', { experienceId: experience._id });
        
        res.json({ message: 'Experiencia actualizada exitosamente', experience });
    } catch (error) {
        await createLog('error', 'Error actualizando experiencia', req.user?.userId, 'update_experience', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Eliminar experiencia (admin)
app.delete('/api/experiences/:id', authenticateToken, async (req, res) => {
    try {
        const experience = await Experience.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );
        
        if (!experience) {
            return res.status(404).json({ error: 'Experiencia no encontrada' });
        }
        
        await createLog('info', 'Experiencia desactivada', req.user.userId, 'delete_experience', { experienceId: req.params.id });
        
        res.json({ message: 'Experiencia desactivada exitosamente' });
    } catch (error) {
        await createLog('error', 'Error desactivando experiencia', req.user?.userId, 'delete_experience', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Agregar reseña a experiencia
app.post('/api/experiences/:id/reviews', authenticateToken, async (req, res) => {
    try {
        const { rating, comment } = req.body;
        
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'El rating debe estar entre 1 y 5' });
        }
        
        const experience = await Experience.findById(req.params.id);
        if (!experience) {
            return res.status(404).json({ error: 'Experiencia no encontrada' });
        }
        
        // Verificar si el usuario ya hizo una reseña
        const existingReview = experience.reviews.find(
            review => review.userId.toString() === req.user.userId
        );
        
        if (existingReview) {
            return res.status(400).json({ error: 'Ya has hecho una reseña para esta experiencia' });
        }
        
        const user = await User.findById(req.user.userId);
        
        experience.reviews.push({
            userId: req.user.userId,
            userName: user.name,
            rating,
            comment
        });
        
        // Recalcular rating promedio
        const totalRating = experience.reviews.reduce((sum, review) => sum + review.rating, 0);
        experience.rating = Math.round((totalRating / experience.reviews.length) * 10) / 10;
        
        await experience.save();
        
        await createLog('info', 'Reseña de experiencia agregada', req.user.userId, 'add_experience_review', { experienceId: req.params.id, rating });
        
        res.json({ message: 'Reseña agregada exitosamente', experience });
    } catch (error) {
        await createLog('error', 'Error agregando reseña de experiencia', req.user?.userId, 'add_experience_review', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// RUTAS PARA SERVIR ARCHIVOS HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/hotels', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'hotels.html'));
});

app.get('/hotel/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'hotel-details.html'));
});

app.get('/account', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'account.html'));
});

app.get('/offers', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'offers.html'));
});

app.get('/experiences', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'experiences.html'));
});

app.get('/destinations', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'destinations.html'));
});

app.get('/experiences', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'experiences.html'));
});

app.get('/destinations', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'destinations.html'));
});

app.get('/reservations', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reservations.html'));
});



app.get('/reservations', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reservations.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Ruta para servir PDFs de reservaciones
app.get('/reservation-pdf/:id', authenticateToken, async (req, res) => {
    try {
        const reservation = await Reservation.findOne({
            _id: req.params.id,
            userId: req.user.userId
        });
        
        if (!reservation || !reservation.pdfUrl) {
            return res.status(404).json({ error: 'PDF no encontrado' });
        }
        
        const filePath = path.join(__dirname, reservation.pdfUrl);
        if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="reservacion_${reservation.reservationNumber}.pdf"`);
            res.sendFile(filePath);
        } else {
            res.status(404).json({ error: 'Archivo PDF no encontrado' });
        }
    } catch (error) {
        await createLog('error', 'Error sirviendo PDF', req.user?.userId, 'serve_pdf', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Middleware para manejo de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('Error global:', err.stack);
    createLog('error', 'Error global del servidor', null, 'server_error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Error interno del servidor' });
});

// Función para limpiar logs antiguos (ejecutar periódicamente)
async function cleanOldLogs() {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const result = await Log.deleteMany({
            createdAt: { $lt: thirtyDaysAgo },
            level: { $ne: 'error' } // Mantener logs de error más tiempo
        });
        
        console.log(`🧹 Logs antiguos limpiados: ${result.deletedCount} registros eliminados`);
    } catch (error) {
        console.error('Error limpiando logs antiguos:', error);
    }
}

// Ejecutar limpieza de logs cada 24 horas
setInterval(cleanOldLogs, 24 * 60 * 60 * 1000);

// Iniciar servidor e insertar datos de ejemplo
app.listen(PORT, async () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
    console.log(`📊 Base de datos: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/vbdhotel'}`);
    await insertSampleData();
    console.log('✅ Servidor VBDHOTEL iniciado correctamente');
});