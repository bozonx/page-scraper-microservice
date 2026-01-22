const basePath = (() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const uiIndex = parts.lastIndexOf('ui');
    if (uiIndex <= 0) {
        return '';
    }
    return `/${parts.slice(0, uiIndex).join('/')}`;
})();

const API_BASE = `${basePath}/api/v1`;

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

function parseCsvList(value) {
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
        return undefined;
    }
    const items = trimmed
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    return items.length ? items : undefined;
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
            userAgent: document.getElementById('page-fp-user-agent').value,
            locale: document.getElementById('page-fp-locale').value,
            timezoneId: document.getElementById('page-fp-timezone').value,
            rotateOnAntiBot: document.getElementById('page-fp-rotate').checked,
            blockTrackers: document.getElementById('page-fp-block-trackers').checked,
            blockHeavyResources: document.getElementById('page-fp-block-heavy').checked,
            operatingSystems: parseCsvList(
                document.getElementById('page-fp-operating-systems').value
            ),
            devices: parseCsvList(document.getElementById('page-fp-devices').value)
        };

        if (body.fingerprint.userAgent?.trim?.() === '') {
            delete body.fingerprint.userAgent;
        }
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

    const fetchLocale = document.getElementById('fetch-locale').value?.trim?.();
    if (fetchLocale) {
        body.locale = fetchLocale;
    }

    const fetchTimezoneId = document.getElementById('fetch-timezone').value?.trim?.();
    if (fetchTimezoneId) {
        body.timezoneId = fetchTimezoneId;
    }

    if (document.getElementById('fetch-fp-generate').checked) {
        body.fingerprint = {
            generate: true,
            userAgent: document.getElementById('fetch-fp-user-agent').value,
            locale: document.getElementById('fetch-fp-locale').value,
            timezoneId: document.getElementById('fetch-fp-timezone').value,
            rotateOnAntiBot: document.getElementById('fetch-fp-rotate').checked,
            blockTrackers: document.getElementById('fetch-fp-block-trackers').checked,
            blockHeavyResources: document.getElementById('fetch-fp-block-heavy').checked,
            operatingSystems: parseCsvList(
                document.getElementById('fetch-fp-operating-systems').value
            ),
            devices: parseCsvList(document.getElementById('fetch-fp-devices').value)
        };

        if (body.fingerprint.userAgent?.trim?.() === '') {
            delete body.fingerprint.userAgent;
        }
    }

    await makeRequest('/fetch', { method: 'POST', body });
});
