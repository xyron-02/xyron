const axios = require('axios');
const config = require('./config');

module.exports = async (req, res) => {
    // CORS biar bisa diakses dari mana aja
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle preflight OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const path = req.url; // contoh: /login
        const method = req.method;
        const query = req.query || {};
        const body = req.body || {};

        // === SISTEM ROUTING INTERNAL ===
        // Semua endpoint diarahkan ke sini, client cuma tau path doang
        const endpointMap = {
            '/login': '/login',
            '/user': '/user',
            '/whitelist': '/whitelist',
            '/check': '/check',
            '/register': '/register',
            // Tambahin endpoint lain disini sesuai kebutuhan
        };

        // Cek apakah path yang diminta valid
        const targetPath = endpointMap[path];
        if (!targetPath) {
            return res.status(404).json({
                status: 'error',
                code: 404,
                message: 'Endpoint tidak ditemukan',
                timestamp: new Date().toISOString()
            });
        }

        // === BUILD TARGET URL ===
        const apiKey = config.api.apiKey;
        const baseUrl = config.api.baseUrl;
        const targetUrl = `${baseUrl}${targetPath}`;

        console.log(`[Proxy] ${method} → ${targetUrl}`);

        // === PREPARE QUERY PARAMS ===
        let finalQuery = { ...query };
        
        // Auto inject apikey untuk GET
        if (method === 'GET') {
            finalQuery.apikey = apiKey;
        }

        // === PREPARE HEADERS ===
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'XYRON-Proxy/1.0'
        };

        // === PREPARE BODY ===
        let finalBody = body;
        if (method !== 'GET' && body && Object.keys(body).length > 0) {
            finalBody = {
                ...body,
                apikey: apiKey // Auto inject apikey untuk POST/PUT/DELETE
            };
        }

        // === EKSEKUSI REQUEST ===
        const response = await axios({
            method: method,
            url: targetUrl,
            data: method !== 'GET' ? finalBody : undefined,
            params: method === 'GET' ? finalQuery : undefined,
            headers: headers,
            timeout: 30000,
            validateStatus: () => true // Biar semua status code diterima
        });

        // === FORMAT RESPONSE ===
        // Tambahin metadata proxy
        const responseData = {
            ...response.data,
            _proxy: {
                status: 'success',
                target: targetUrl,
                method: method,
                timestamp: new Date().toISOString()
            }
        };

        // Kalo response dari API utama udah punya status, kita ikutin
        return res.status(response.status).json(responseData);

    } catch (error) {
        console.error('[Proxy Error]', error.message);
        console.error('[Proxy Error Detail]', error.stack);

        // === HANDLE ERROR ===
        let statusCode = 500;
        let errorMessage = 'Terjadi kesalahan pada proxy';
        let errorCode = 'INTERNAL_ERROR';

        if (error.code === 'ECONNREFUSED') {
            statusCode = 503;
            errorMessage = 'Server utama tidak tersedia';
            errorCode = 'CONNECTION_REFUSED';
        } else if (error.code === 'ETIMEDOUT') {
            statusCode = 504;
            errorMessage = 'Server utama timeout';
            errorCode = 'TIMEOUT';
        } else if (error.response) {
            // Kalo API utama ngasih response error
            statusCode = error.response.status || 500;
            errorMessage = error.response.data?.message || error.message;
            errorCode = error.response.data?.code || 'API_ERROR';
            
            // Forward response dari API utama
            return res.status(statusCode).json({
                status: 'error',
                code: errorCode,
                message: errorMessage,
                timestamp: new Date().toISOString(),
                _proxy: {
                    target: targetUrl,
                    method: method
                }
            });
        }

        return res.status(statusCode).json({
            status: 'error',
            code: errorCode,
            message: errorMessage,
            timestamp: new Date().toISOString(),
            _proxy: {
                target: targetUrl,
                method: method
            }
        });
    }
};
