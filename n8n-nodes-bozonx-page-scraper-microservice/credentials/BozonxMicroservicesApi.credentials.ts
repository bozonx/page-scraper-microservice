import type { ICredentialType, INodeProperties, Icon } from 'n8n-workflow'

export class BozonxMicroservicesApi implements ICredentialType {
  name = 'bozonxMicroservicesApi'
  displayName = 'Page Scraper API'
  documentationUrl =
    'https://github.com/bozonx/page-scraper-microservice/tree/main/n8n-nodes-bozonx-page-scraper-microservice#readme'
  icon = 'file:../nodes/PageScraper/pageScraper.svg' as unknown as Icon
  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://page-scraper.example.com/api/v1',
      placeholder: 'https://page-scraper.example.com/api/v1',
      required: true,
      description:
        'Full base URL of the Page Scraper microservice API (including /api/v1 or custom path)',
    },
    {
      displayName: 'Authentication',
      name: 'authentication',
      type: 'options',
      options: [
        {
          name: 'None',
          value: 'none',
        },
        {
          name: 'Basic Auth',
          value: 'basic',
        },
        {
          name: 'Bearer Token',
          value: 'bearer',
        },
      ],
      default: 'none',
      description: 'Authentication method to use',
    },
    {
      displayName: 'Username',
      name: 'username',
      type: 'string',
      default: '',
      required: true,
      description: 'Username for Basic authentication',
      displayOptions: {
        show: {
          authentication: ['basic'],
        },
      },
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Password for Basic authentication',
      displayOptions: {
        show: {
          authentication: ['basic'],
        },
      },
    },
    {
      displayName: 'Token',
      name: 'token',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Bearer token for Authorization header',
      displayOptions: {
        show: {
          authentication: ['bearer'],
        },
      },
    },
  ]

  authenticate: ICredentialType['authenticate'] = {
    type: 'generic',
    properties: {
      headers: {
        Authorization:
          '={{$credentials.authentication === "bearer" ? ("Bearer " + $credentials.token) : ($credentials.authentication === "basic" ? ("Basic " + Buffer.from($credentials.username + ":" + $credentials.password).toString("base64")) : undefined)}}',
      },
    },
  }

  test: ICredentialType['test'] = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/health',
    },
  }
}
