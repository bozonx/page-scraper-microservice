import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

export class PageScraper implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Page Scraper',
    name: 'pageScraper',
    icon: 'file:pageScraper.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Scrape web pages, extract content, or process batches',
    defaults: {
      name: 'Page Scraper',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'bozonxMicroservicesApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Scrape Page',
            value: 'page',
            description: 'Extract structured article content from a single page',
            action: 'Scrape a single page',
          },
          {
            name: 'Get HTML',
            value: 'html',
            description: 'Retrieve raw HTML content from a page',
            action: 'Get raw HTML from a page',
          },
          {
            name: 'Create Batch',
            value: 'batch',
            description: 'Create an asynchronous batch scraping job',
            action: 'Create a batch scraping job',
          },
          {
            name: 'Get Batch Status',
            value: 'batchStatus',
            description: 'Get status and results of a batch job',
            action: 'Get batch job status',
          },
        ],
        default: 'page',
      },

      // ============ PAGE OPERATION ============
      {
        displayName: 'URL',
        name: 'url',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['page', 'html'],
          },
        },
        default: '',
        required: true,
        description: 'Target page URL to scrape',
        placeholder: 'https://example.com/article',
      },
      {
        displayName: 'Scraper Mode',
        name: 'mode',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['page'],
          },
        },
        options: [
          {
            name: 'Extractor',
            value: 'extractor',
            description: 'Fast static HTML extraction',
          },
          {
            name: 'Playwright',
            value: 'playwright',
            description: 'Full browser rendering with JavaScript support',
          },
        ],
        default: 'extractor',
        description: 'Scraper engine to use',
      },
      {
        displayName: 'Raw Body',
        name: 'rawBody',
        type: 'boolean',
        displayOptions: {
          show: {
            operation: ['page'],
          },
        },
        default: false,
        description: 'Whether to return body as provided by extractor (no Markdown conversion)',
      },
      {
        displayName: 'Additional Options',
        name: 'additionalOptions',
        type: 'collection',
        displayOptions: {
          show: {
            operation: ['page', 'html'],
          },
        },
        default: {},
        placeholder: 'Add Option',
        options: [
          {
            displayName: 'Task Timeout (Seconds)',
            name: 'taskTimeoutSecs',
            type: 'number',
            default: 30,
            description: 'Maximum time for the entire operation',
          },
          {
            displayName: 'Locale',
            name: 'locale',
            type: 'string',
            default: 'en-US',
            description: 'Preferred locale for extraction',
            placeholder: 'en-US',
          },
          {
            displayName: 'Date Locale',
            name: 'dateLocale',
            type: 'string',
            displayOptions: {
              show: {
                '/operation': ['page'],
              },
            },
            default: '',
            description: 'Locale for date parsing (falls back to locale if empty)',
            placeholder: 'en-US',
          },
          {
            displayName: 'Timezone ID',
            name: 'timezoneId',
            type: 'string',
            default: 'UTC',
            description: 'Target timezone for date normalization',
            placeholder: 'UTC',
          },
          {
            displayName: 'Block Trackers',
            name: 'blockTrackers',
            type: 'boolean',
            default: true,
            description: 'Whether to block analytics and tracking scripts',
          },
          {
            displayName: 'Block Heavy Resources',
            name: 'blockHeavyResources',
            type: 'boolean',
            default: true,
            description: 'Whether to block heavy media and fonts',
          },
        ],
      },
      {
        displayName: 'Fingerprint Options',
        name: 'fingerprintOptions',
        type: 'collection',
        displayOptions: {
          show: {
            operation: ['page', 'html'],
          },
        },
        default: {},
        placeholder: 'Add Fingerprint Option',
        options: [
          {
            displayName: 'Generate Fingerprint',
            name: 'generate',
            type: 'boolean',
            default: true,
            description: 'Whether to automatically generate browser fingerprint',
          },
          {
            displayName: 'User Agent',
            name: 'userAgent',
            type: 'string',
            default: 'auto',
            description: 'Custom user agent string or "auto"',
            placeholder: 'auto',
          },
          {
            displayName: 'Fingerprint Locale',
            name: 'locale',
            type: 'string',
            default: 'source',
            description: 'Browser locale or "source" to randomize',
            placeholder: 'source',
          },
          {
            displayName: 'Fingerprint Timezone',
            name: 'timezoneId',
            type: 'string',
            default: 'source',
            description: 'Browser timezone or "source" to randomize',
            placeholder: 'source',
          },
          {
            displayName: 'Rotate On Anti-Bot',
            name: 'rotateOnAntiBot',
            type: 'boolean',
            default: true,
            description: 'Whether to rotate fingerprint when anti-bot behavior is detected',
          },
          {
            displayName: 'Allowed Browsers',
            name: 'browsers',
            type: 'string',
            default: 'chrome,firefox',
            description: 'Comma-separated list of allowed browsers',
            placeholder: 'chrome,firefox',
          },
        ],
      },

      // ============ BATCH OPERATION ============
      {
        displayName: 'Job ID',
        name: 'jobId',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['batchStatus'],
          },
        },
        default: '',
        required: true,
        description: 'Batch job ID to query',
        placeholder: '0f1c5d8e-3d4b-4c0f-8f0c-5c2d2d7b9c6a',
      },
      {
        displayName: 'Items',
        name: 'items',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        displayOptions: {
          show: {
            operation: ['batch'],
          },
        },
        default: {},
        placeholder: 'Add Item',
        options: [
          {
            name: 'item',
            displayName: 'Item',
            values: [
              {
                displayName: 'URL',
                name: 'url',
                type: 'string',
                default: '',
                required: true,
                description: 'URL to scrape',
                placeholder: 'https://example.com/article',
              },
              {
                displayName: 'Mode',
                name: 'mode',
                type: 'options',
                options: [
                  {
                    name: 'Extractor',
                    value: 'extractor',
                  },
                  {
                    name: 'Playwright',
                    value: 'playwright',
                  },
                ],
                default: 'extractor',
                description: 'Scraper mode (optional, uses common settings if empty)',
              },
            ],
          },
        ],
        description: 'URLs to scrape in batch',
      },
      {
        displayName: 'Common Settings',
        name: 'commonSettings',
        type: 'collection',
        displayOptions: {
          show: {
            operation: ['batch'],
          },
        },
        default: {},
        placeholder: 'Add Common Setting',
        options: [
          {
            displayName: 'Mode',
            name: 'mode',
            type: 'options',
            options: [
              {
                name: 'Extractor',
                value: 'extractor',
              },
              {
                name: 'Playwright',
                value: 'playwright',
              },
            ],
            default: 'extractor',
            description: 'Default scraper mode for all items',
          },
          {
            displayName: 'Task Timeout (Seconds)',
            name: 'taskTimeoutSecs',
            type: 'number',
            default: 60,
            description: 'Default timeout for each item',
          },
          {
            displayName: 'Raw Body',
            name: 'rawBody',
            type: 'boolean',
            default: false,
            description: 'Whether to return body without Markdown conversion',
          },
          {
            displayName: 'Locale',
            name: 'locale',
            type: 'string',
            default: 'en-US',
            description: 'Preferred locale',
          },
          {
            displayName: 'Timezone ID',
            name: 'timezoneId',
            type: 'string',
            default: 'UTC',
            description: 'Target timezone',
          },
        ],
      },
      {
        displayName: 'Schedule Options',
        name: 'scheduleOptions',
        type: 'collection',
        displayOptions: {
          show: {
            operation: ['batch'],
          },
        },
        default: {},
        placeholder: 'Add Schedule Option',
        options: [
          {
            displayName: 'Min Delay (Ms)',
            name: 'minDelayMs',
            type: 'number',
            default: 1500,
            description: 'Minimum wait between requests (500-30000)',
          },
          {
            displayName: 'Max Delay (Ms)',
            name: 'maxDelayMs',
            type: 'number',
            default: 4000,
            description: 'Maximum wait between requests (1000-60000)',
          },
          {
            displayName: 'Jitter',
            name: 'jitter',
            type: 'boolean',
            default: true,
            description: 'Whether to add ±20% random jitter to delays',
          },
        ],
      },
      {
        displayName: 'Webhook Options',
        name: 'webhookOptions',
        type: 'collection',
        displayOptions: {
          show: {
            operation: ['batch'],
          },
        },
        default: {},
        placeholder: 'Add Webhook Option',
        options: [
          {
            displayName: 'Webhook URL',
            name: 'url',
            type: 'string',
            default: '',
            description: 'Destination endpoint for webhook notification',
            placeholder: 'https://example.com/webhook',
          },
          {
            displayName: 'Headers',
            name: 'headers',
            type: 'fixedCollection',
            typeOptions: {
              multipleValues: true,
            },
            default: {},
            placeholder: 'Add Header',
            options: [
              {
                name: 'header',
                displayName: 'Header',
                values: [
                  {
                    displayName: 'Name',
                    name: 'name',
                    type: 'string',
                    default: '',
                    description: 'Header name',
                  },
                  {
                    displayName: 'Value',
                    name: 'value',
                    type: 'string',
                    default: '',
                    description: 'Header value',
                  },
                ],
              },
            ],
          },
          {
            displayName: 'Backoff (Ms)',
            name: 'backoffMs',
            type: 'number',
            default: 1000,
            description: 'Base delay for exponential backoff (100-30000)',
          },
          {
            displayName: 'Max Attempts',
            name: 'maxAttempts',
            type: 'number',
            default: 3,
            description: 'Maximum retry attempts (1-10)',
          },
        ],
      },
    ],
		usableAsTool: true,
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const operation = this.getNodeParameter('operation', 0) as string;

    const credentials = await this.getCredentials('bozonxMicroservicesApi');
    const baseUrl = (credentials.gatewayUrl as string).replace(/\/$/, '');
    const apiUrl = `${baseUrl}/api/v1`;

    for (let i = 0; i < items.length; i++) {
      try {
        if (operation === 'page') {
          const url = this.getNodeParameter('url', i) as string;
          const mode = this.getNodeParameter('mode', i) as string;
          const rawBody = this.getNodeParameter('rawBody', i) as boolean;
          const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as Record<string, any>;
          const fingerprintOptions = this.getNodeParameter('fingerprintOptions', i, {}) as Record<string, any>;

          const body: Record<string, any> = {
            url,
            mode,
            rawBody,
            ...additionalOptions,
          };

          // Build fingerprint object if any options are set
          if (Object.keys(fingerprintOptions).length > 0) {
            const fingerprint: Record<string, any> = {};
            
            if (fingerprintOptions.generate !== undefined) {
              fingerprint.generate = fingerprintOptions.generate;
            }
            if (fingerprintOptions.userAgent) {
              fingerprint.userAgent = fingerprintOptions.userAgent;
            }
            if (fingerprintOptions.locale) {
              fingerprint.locale = fingerprintOptions.locale;
            }
            if (fingerprintOptions.timezoneId) {
              fingerprint.timezoneId = fingerprintOptions.timezoneId;
            }
            if (fingerprintOptions.rotateOnAntiBot !== undefined) {
              fingerprint.rotateOnAntiBot = fingerprintOptions.rotateOnAntiBot;
            }
            if (fingerprintOptions.browsers) {
              fingerprint.generator = {
                browsers: fingerprintOptions.browsers.split(',').map((b: string) => b.trim()),
              };
            }

            if (Object.keys(fingerprint).length > 0) {
              body.fingerprint = fingerprint;
            }
          }

          const response = await this.helpers.httpRequestWithAuthentication.call(
            this,
            'bozonxMicroservicesApi',
            {
              method: 'POST',
              url: `${apiUrl}/page`,
              body,
              json: true,
            },
          );

          returnData.push({
            json: response as Record<string, any>,
            pairedItem: { item: i },
          });

        } else if (operation === 'html') {
          const url = this.getNodeParameter('url', i) as string;
          const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as Record<string, any>;
          const fingerprintOptions = this.getNodeParameter('fingerprintOptions', i, {}) as Record<string, any>;

          const body: Record<string, any> = {
            url,
            ...additionalOptions,
          };

          // Build fingerprint object
          if (Object.keys(fingerprintOptions).length > 0) {
            const fingerprint: Record<string, any> = {};
            
            if (fingerprintOptions.generate !== undefined) {
              fingerprint.generate = fingerprintOptions.generate;
            }
            if (fingerprintOptions.userAgent) {
              fingerprint.userAgent = fingerprintOptions.userAgent;
            }
            if (fingerprintOptions.locale) {
              fingerprint.locale = fingerprintOptions.locale;
            }
            if (fingerprintOptions.timezoneId) {
              fingerprint.timezoneId = fingerprintOptions.timezoneId;
            }
            if (fingerprintOptions.rotateOnAntiBot !== undefined) {
              fingerprint.rotateOnAntiBot = fingerprintOptions.rotateOnAntiBot;
            }
            if (fingerprintOptions.browsers) {
              fingerprint.generator = {
                browsers: fingerprintOptions.browsers.split(',').map((b: string) => b.trim()),
              };
            }

            if (Object.keys(fingerprint).length > 0) {
              body.fingerprint = fingerprint;
            }
          }

          const response = await this.helpers.httpRequestWithAuthentication.call(
            this,
            'bozonxMicroservicesApi',
            {
              method: 'POST',
              url: `${apiUrl}/html`,
              body,
              json: true,
            },
          );

          returnData.push({
            json: response as Record<string, any>,
            pairedItem: { item: i },
          });

        } else if (operation === 'batch') {
          const itemsParam = this.getNodeParameter('items', i, {}) as any;
          const commonSettings = this.getNodeParameter('commonSettings', i, {}) as Record<string, any>;
          const scheduleOptions = this.getNodeParameter('scheduleOptions', i, {}) as Record<string, any>;
          const webhookOptions = this.getNodeParameter('webhookOptions', i, {}) as Record<string, any>;

          const body: Record<string, any> = {
            items: [],
          };

          // Build items array
          if (itemsParam.item && Array.isArray(itemsParam.item)) {
            body.items = itemsParam.item.map((item: any) => {
              const batchItem: Record<string, any> = { url: item.url };
              if (item.mode) {
                batchItem.mode = item.mode;
              }
              return batchItem;
            });
          }

          // Add common settings
          if (Object.keys(commonSettings).length > 0) {
            body.commonSettings = commonSettings;
          }

          // Add schedule
          if (Object.keys(scheduleOptions).length > 0) {
            body.schedule = scheduleOptions;
          }

          // Add webhook
          if (webhookOptions.url) {
            const webhook: Record<string, any> = {
              url: webhookOptions.url,
            };

            if (webhookOptions.headers?.header && Array.isArray(webhookOptions.headers.header)) {
              webhook.headers = {};
              webhookOptions.headers.header.forEach((h: any) => {
                if (h.name && h.value) {
                  webhook.headers[h.name] = h.value;
                }
              });
            }

            if (webhookOptions.backoffMs !== undefined) {
              webhook.backoffMs = webhookOptions.backoffMs;
            }
            if (webhookOptions.maxAttempts !== undefined) {
              webhook.maxAttempts = webhookOptions.maxAttempts;
            }

            body.webhook = webhook;
          }

          const response = await this.helpers.httpRequestWithAuthentication.call(
            this,
            'bozonxMicroservicesApi',
            {
              method: 'POST',
              url: `${apiUrl}/batch`,
              body,
              json: true,
            },
          );

          returnData.push({
            json: response as Record<string, any>,
            pairedItem: { item: i },
          });

        } else if (operation === 'batchStatus') {
          const jobId = this.getNodeParameter('jobId', i) as string;

          const response = await this.helpers.httpRequestWithAuthentication.call(
            this,
            'bozonxMicroservicesApi',
            {
              method: 'GET',
              url: `${apiUrl}/batch/${jobId}`,
              json: true,
            },
          );

          returnData.push({
            json: response as Record<string, any>,
            pairedItem: { item: i },
          });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: error.message,
            },
            pairedItem: { item: i },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
