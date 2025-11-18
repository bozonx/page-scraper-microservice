import type { ICredentialType, INodeProperties, Icon } from 'n8n-workflow'

export class BozonxMicroservicesApi implements ICredentialType {
  name = 'bozonxMicroservicesApi'
  displayName = 'Bozonx Microservices API'
  documentationUrl =
    'https://github.com/bozonx/news-crawler-microservice/tree/main/n8n-nodes-bozonx-news-crawler-microservice#readme'
  icon: Icon = {
    light: 'file:bozonxMicroservicesApi.svg',
    dark: 'file:bozonxMicroservicesApi.dark.svg',
  }
  properties: INodeProperties[] = [
    {
      displayName: 'Gateway URL',
      name: 'gatewayUrl',
      type: 'string',
      default: '',
      placeholder: 'https://api.example.com',
      required: true,
      description: 'Base URL of the API Gateway (without /api/v1)',
    },
    {
      displayName: 'API Token',
      name: 'apiToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: false,
      description: 'Optional Bearer token for Authorization header',
    },
  ]

  authenticate: ICredentialType['authenticate'] = {
    type: 'generic',
    properties: {
      headers: {
        Authorization:
          '={{$credentials.apiToken ? ("Bearer " + $credentials.apiToken) : undefined}}',
      },
    },
  }
}
