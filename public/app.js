const API_BASE = '/api/v1';

const $result = document.getElementById('result');
const $loading = document.getElementById('loading');
const $clearBtn = document.getElementById('clear-result');

const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetTab = button.dataset.tab;
        
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        document.getElementById(`${targetTab}-tab`).classList.add('active');
    });
});

$clearBtn.addEventListener('click', () => {
    $result.textContent = '';
});

function showLoading() {
    $loading.classList.remove('hidden');
    $result.textContent = '';
}

function hideLoading() {
    $loading.classList.add('hidden');
}

function displayResult(data, isError = false) {
    hideLoading();
    $result.textContent = JSON.stringify(data, null, 2);
    if (isError) {
        $result.style.borderLeft = '4px solid var(--error-color)';
    } else {
        $result.style.borderLeft = '4px solid var(--success-color)';
    }
}

async function makeRequest(endpoint, options = {}) {
    showLoading();
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            body: options.body ? JSON.stringify(options.body) : undefined
        });

        const data = await response.json();
        
        if (!response.ok) {
            displayResult({ 
                status: response.status, 
                statusText: response.statusText,
                error: data 
            }, true);
        } else {
            displayResult(data);
        }
    } catch (error) {
        displayResult({ 
            error: 'Request failed', 
            message: error.message 
        }, true);
    }
}

document.getElementById('page-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const body = {
        url: document.getElementById('page-url').value,
        mode: document.getElementById('page-mode').value,
        rawBody: document.getElementById('page-raw-body').checked,
        taskTimeoutSecs: parseInt(document.getElementById('page-timeout').value)
    };

    if (document.getElementById('page-fp-generate').checked) {
        body.fingerprint = {
            generate: true,
            locale: document.getElementById('page-fp-locale').value,
            timezoneId: document.getElementById('page-fp-timezone').value,
            rotateOnAntiBot: document.getElementById('page-fp-rotate').checked,
            blockTrackers: document.getElementById('page-fp-block-trackers').checked,
            blockHeavyResources: document.getElementById('page-fp-block-heavy').checked
        };
    }

    await makeRequest('/page', { method: 'POST', body });
});

document.getElementById('fetch-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const body = {
        url: document.getElementById('fetch-url').value,
        engine: document.getElementById('fetch-engine').value,
        timeoutSecs: parseInt(document.getElementById('fetch-timeout').value),
        debug: document.getElementById('fetch-debug').checked
    };

    if (document.getElementById('fetch-fp-generate').checked) {
        body.fingerprint = {
            generate: true,
            locale: document.getElementById('fetch-fp-locale').value,
            timezoneId: document.getElementById('fetch-fp-timezone').value,
            rotateOnAntiBot: document.getElementById('fetch-fp-rotate').checked,
            blockTrackers: document.getElementById('fetch-fp-block-trackers').checked,
            blockHeavyResources: document.getElementById('fetch-fp-block-heavy').checked
        };
    }

    await makeRequest('/fetch', { method: 'POST', body });
});

document.getElementById('batch-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const urls = document.getElementById('batch-urls').value
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

    const body = {
        items: urls.map(url => ({ url })),
        commonSettings: {
            mode: document.getElementById('batch-mode').value,
            taskTimeoutSecs: parseInt(document.getElementById('batch-timeout').value)
        },
        schedule: {
            minDelayMs: parseInt(document.getElementById('batch-min-delay').value),
            maxDelayMs: parseInt(document.getElementById('batch-max-delay').value),
            jitter: document.getElementById('batch-jitter').checked
        }
    };

    const webhookUrl = document.getElementById('batch-webhook-url').value;
    if (webhookUrl) {
        body.webhook = {
            url: webhookUrl,
            timeoutSecs: parseInt(document.getElementById('batch-webhook-timeout').value),
            maxAttempts: parseInt(document.getElementById('batch-webhook-attempts').value)
        };
    }

    await makeRequest('/batch', { method: 'POST', body });
});

document.getElementById('status-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const jobId = document.getElementById('status-job-id').value;
    await makeRequest(`/batch/${jobId}`);
});
