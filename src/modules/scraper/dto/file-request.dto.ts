import { IsString, IsOptional, IsInt, Min, IsObject, IsIn, IsUrl } from 'class-validator'

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
  public headers?: Record<string, string>
}
