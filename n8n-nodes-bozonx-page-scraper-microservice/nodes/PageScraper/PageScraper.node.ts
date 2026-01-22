import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow'
import * as yaml from 'js-yaml'

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
        name: 'pageScraperApi',
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
            name: 'Fetch Content',
            value: 'fetch',
            description: 'Fetch raw content from a URL (HTML/XML/RSS)',
            action: 'Fetch raw content from a URL',
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
            operation: ['page', 'fetch'],
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
        displayName: 'Fetch Engine',
        name: 'fetchEngine',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['fetch'],
          },
        },
        options: [
          {
            name: 'HTTP',
            value: 'http',
            description: 'Fast HTTP fetch without browser rendering',
          },
          {
            name: 'Playwright',
            value: 'playwright',
            description: 'Full browser rendering for JavaScript-heavy sites',
          },
        ],
        default: 'http',
        description: 'Fetch engine to use',
      },
      {
        displayName: 'Additional Options',
        name: 'additionalOptions',
        type: 'collection',
        displayOptions: {
          show: {
            operation: ['page', 'fetch'],
          },
        },
        default: {},
        placeholder: 'Add Option',
        options: [
          {
            displayName: 'Task Timeout (Seconds)',
            name: 'taskTimeoutSecs',
            type: 'number',
            default: 60,
            description: 'Maximum time for the entire operation',
          },
          {
            displayName: 'Fingerprint: Generate',
            name: 'fingerprintGenerate',
            type: 'boolean',
            default: true,
            description: 'Whether to automatically generate browser fingerprint',
          },
          {
            displayName: 'Fingerprint: Block Trackers',
            name: 'fingerprintBlockTrackers',
            type: 'boolean',
            default: true,
            description: 'Whether to block analytics and tracking scripts (Playwright only)',
          },
          {
            displayName: 'Fingerprint: Block Heavy Resources',
            name: 'fingerprintBlockHeavyResources',
            type: 'boolean',
            default: true,
            description: 'Whether to block heavy media and fonts (Playwright only)',
          },
          {
            displayName: 'Fingerprint: User Agent',
            name: 'fingerprintUserAgent',
            type: 'string',
            default: 'auto',
            description: 'Custom user agent string or "auto"',
            placeholder: 'auto',
          },
          {
            displayName: 'Fingerprint: Locale',
            name: 'fingerprintLocale',
            type: 'string',
            default: 'auto',
            description: 'Browser locale or "auto" to let generator decide',
            placeholder: 'auto',
          },
          {
            displayName: 'Fingerprint: Timezone',
            name: 'fingerprintTimezoneId',
            type: 'string',
            default: 'UTC',
            description: 'Browser timezone ("auto" is not supported, omit to use default)',
            placeholder: 'UTC',
          },
          {
            displayName: 'Fingerprint: Rotate On Anti-Bot',
            name: 'fingerprintRotateOnAntiBot',
            type: 'boolean',
            default: true,
            description: 'Whether to rotate fingerprint when anti-bot behavior is detected',
          },
          {
            displayName: 'Fingerprint: Operating Systems',
            name: 'fingerprintOperatingSystems',
            type: 'string',
            default: 'windows,macos,linux',
            description:
              'Comma-separated list of operating systems to simulate (e.g., windows,macos,linux,android,ios)',
            placeholder: 'windows,macos',
          },
          {
            displayName: 'Fingerprint: Devices',
            name: 'fingerprintDevices',
            type: 'string',
            default: 'desktop,mobile',
            description: 'Comma-separated list of device types to simulate (e.g., desktop,mobile)',
            placeholder: 'desktop',
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
        displayName: 'Options (YAML/JSON)',
        name: 'options',
        type: 'string',
        typeOptions: {
          rows: 12,
        },
        displayOptions: {
          show: {
            operation: ['batch'],
          },
        },
        default: '',
        required: true,
        description:
          'Batch request configuration in YAML or JSON format. All fields will be sent to the server as-is',
        placeholder:
          'items:\n  - url: https://example.com/page1\n    mode: extractor\n  - url: https://example.com/page2\ncommonSettings:\n  rawBody: false\nschedule:\n  minDelayMs: 1500\n  maxDelayMs: 4000\n  jitter: true',
      },
    ],
    usableAsTool: true,
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData()
    const returnData: INodeExecutionData[] = []
    const operation = this.getNodeParameter('operation', 0) as string

    const credentials = await this.getCredentials('pageScraperApi')
    const apiUrl = (credentials.baseUrl as string).replace(/\/$/, '') + '/api/v1'

    for (let i = 0; i < items.length; i++) {
      try {
        if (operation === 'page') {
          const url = this.getNodeParameter('url', i) as string
          const mode = this.getNodeParameter('mode', i) as string
          const rawBody = this.getNodeParameter('rawBody', i) as boolean
          const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as Record<
            string,
            any
          >

          const body: Record<string, any> = {
            url,
            mode,
            rawBody,
          }

          // Add non-fingerprint additional options
          if (additionalOptions.taskTimeoutSecs !== undefined) {
            body.taskTimeoutSecs = additionalOptions.taskTimeoutSecs
          }

          // Build fingerprint object from additionalOptions
          const fingerprint: Record<string, any> = {}

          if (additionalOptions.fingerprintGenerate !== undefined) {
            fingerprint.generate = additionalOptions.fingerprintGenerate
          }
          if (additionalOptions.fingerprintBlockTrackers !== undefined) {
            fingerprint.blockTrackers = additionalOptions.fingerprintBlockTrackers
          }
          if (additionalOptions.fingerprintBlockHeavyResources !== undefined) {
            fingerprint.blockHeavyResources = additionalOptions.fingerprintBlockHeavyResources
          }
          if (additionalOptions.fingerprintUserAgent) {
            fingerprint.userAgent = additionalOptions.fingerprintUserAgent
          }
          if (additionalOptions.fingerprintLocale) {
            fingerprint.locale = additionalOptions.fingerprintLocale
          }
          if (additionalOptions.fingerprintTimezoneId) {
            fingerprint.timezoneId = additionalOptions.fingerprintTimezoneId
          }
          if (additionalOptions.fingerprintRotateOnAntiBot !== undefined) {
            fingerprint.rotateOnAntiBot = additionalOptions.fingerprintRotateOnAntiBot
          }
          if (additionalOptions.fingerprintOperatingSystems) {
            fingerprint.operatingSystems = additionalOptions.fingerprintOperatingSystems
              .split(',')
              .map((os: string) => os.trim())
          }
          if (additionalOptions.fingerprintDevices) {
            fingerprint.devices = additionalOptions.fingerprintDevices
              .split(',')
              .map((d: string) => d.trim())
          }

          if (Object.keys(fingerprint).length > 0) {
            body.fingerprint = fingerprint
          }

          const response = await this.helpers.httpRequestWithAuthentication.call(
            this,
            'pageScraperApi',
            {
              method: 'POST',
              url: `${apiUrl}/page`,
              body,
              json: true,
            }
          )

          returnData.push({
            json: response as Record<string, any>,
            pairedItem: { item: i },
          })
        } else if (operation === 'fetch') {
          const url = this.getNodeParameter('url', i) as string
          const fetchEngine = this.getNodeParameter('fetchEngine', i) as string
          const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as Record<
            string,
            any
          >

          const body: Record<string, any> = {
            url,
            engine: fetchEngine,
          }

          if (additionalOptions.taskTimeoutSecs !== undefined) {
            body.timeoutSecs = additionalOptions.taskTimeoutSecs
          }

          // Build fingerprint object from additionalOptions
          const fingerprint: Record<string, any> = {}

          if (additionalOptions.fingerprintGenerate !== undefined) {
            fingerprint.generate = additionalOptions.fingerprintGenerate
          }
          if (additionalOptions.fingerprintBlockTrackers !== undefined) {
            fingerprint.blockTrackers = additionalOptions.fingerprintBlockTrackers
          }
          if (additionalOptions.fingerprintBlockHeavyResources !== undefined) {
            fingerprint.blockHeavyResources = additionalOptions.fingerprintBlockHeavyResources
          }
          if (additionalOptions.fingerprintUserAgent) {
            fingerprint.userAgent = additionalOptions.fingerprintUserAgent
          }
          if (additionalOptions.fingerprintLocale) {
            fingerprint.locale = additionalOptions.fingerprintLocale
          }
          if (additionalOptions.fingerprintTimezoneId) {
            fingerprint.timezoneId = additionalOptions.fingerprintTimezoneId
          }
          if (additionalOptions.fingerprintRotateOnAntiBot !== undefined) {
            fingerprint.rotateOnAntiBot = additionalOptions.fingerprintRotateOnAntiBot
          }
          if (additionalOptions.fingerprintOperatingSystems) {
            fingerprint.operatingSystems = additionalOptions.fingerprintOperatingSystems
              .split(',')
              .map((os: string) => os.trim())
          }
          if (additionalOptions.fingerprintDevices) {
            fingerprint.devices = additionalOptions.fingerprintDevices
              .split(',')
              .map((d: string) => d.trim())
          }

          if (Object.keys(fingerprint).length > 0) {
            body.fingerprint = fingerprint
          }

          const response = await this.helpers.httpRequestWithAuthentication.call(
            this,
            'pageScraperApi',
            {
              method: 'POST',
              url: `${apiUrl}/fetch`,
              body,
              json: true,
            }
          )

          returnData.push({
            json: response as Record<string, any>,
            pairedItem: { item: i },
          })
        } else if (operation === 'batch') {
          const optionsParam = this.getNodeParameter('options', i) as any
          let body: Record<string, any>

          if (typeof optionsParam === 'string') {
            try {
              body = yaml.load(optionsParam) as Record<string, any>
            } catch (yamlError) {
              try {
                body = JSON.parse(optionsParam)
              } catch (jsonError) {
                throw new Error(
                  `Failed to parse options field. It must be valid YAML or JSON. YAML error: ${(yamlError as Error).message}, JSON error: ${(jsonError as Error).message}`
                )
              }
            }
          } else {
            body = JSON.parse(JSON.stringify(optionsParam))
          }

          const response = await this.helpers.httpRequestWithAuthentication.call(
            this,
            'pageScraperApi',
            {
              method: 'POST',
              url: `${apiUrl}/batch`,
              body,
              json: true,
            }
          )

          returnData.push({
            json: response as Record<string, any>,
            pairedItem: { item: i },
          })
        } else if (operation === 'batchStatus') {
          const jobId = this.getNodeParameter('jobId', i) as string

          const response = await this.helpers.httpRequestWithAuthentication.call(
            this,
            'pageScraperApi',
            {
              method: 'GET',
              url: `${apiUrl}/batch/${jobId}`,
              json: true,
            }
          )

          returnData.push({
            json: response as Record<string, any>,
            pairedItem: { item: i },
          })
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: (error as Error).message,
            },
            pairedItem: { item: i },
          })
          continue
        }
        throw error
      }
    }

    return [returnData]
  }
}
