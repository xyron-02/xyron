const axios = require('axios');
const config = require('../config');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const path = req.url;
        const method = req.method;
        const query = req.query;
        const body = req.body;

        const apiKey = config.api.apiKey;

        const targetUrl = `${config.api.baseUrl}${path}`;

        console.log(`[Proxy] ${method} ${targetUrl}`);

        let finalQuery = { ...query };
        if (method === 'GET') {
            finalQuery.apikey = apiKey;
        }

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        let finalBody = body;
        if (method !== 'GET' && body) {
            finalBody = {
                ...body,
                apikey: apiKey
            };
        }

        const response = await axios({
            method: method,
            url: targetUrl,
            data: method !== 'GET' ? finalBody : undefined,
            params: method === 'GET' ? finalQuery : undefined,
            headers: headers,
            timeout: 30000,
            validateStatus: () => true
        });

        return res.status(response.status).json(response.data);

    } catch (error) {
        console.error('[Proxy Error]', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                status: 'error',
                code: 503,
                message: 'Server utama tidak tersedia',
                error: 'Connection refused',
                timestamp: new Date().toISOString()
            });
        }

        if (error.code === 'ETIMEDOUT') {
            return res.status(504).json({
                status: 'error',
                code: 504,
                message: 'Server utama timeout',
                error: 'Request timeout',
                timestamp: new Date().toISOString()
            });
        }

        return res.status(500).json({
            status: 'error',
            code: 500,
            message: 'Terjadi kesalahan pada proxy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};