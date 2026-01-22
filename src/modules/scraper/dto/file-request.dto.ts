import {
  IsOptional,
  IsInt,
  Min,
  IsObject,
  IsIn,
  IsUrl,
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator'

function IsStringRecord(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'IsStringRecord',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value == null) return true
          if (typeof value !== 'object') return false
          if (Array.isArray(value)) return false
          for (const v of Object.values(value as Record<string, unknown>)) {
            if (typeof v !== 'string') return false
          }
          return true
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be an object with string values`
        },
      },
    })
  }
}

export class FileRequestDto {
  @IsUrl({ require_tld: false })
  public url!: string

  @IsOptional()
  @IsIn(['auto', 'http', 'playwright'])
  public mode?: 'auto' | 'http' | 'playwright'

  @IsOptional()
  @IsInt()
  @Min(1)
  public timeoutSecs?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  public maxBytes?: number

  @IsOptional()
  @IsObject()
  @IsStringRecord()
  public headers?: Record<string, string>
}
