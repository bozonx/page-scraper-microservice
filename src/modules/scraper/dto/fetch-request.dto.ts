import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  IsObject,
  ValidateNested,
  IsUrl,
  IsIn,
} from 'class-validator'
import { Type } from 'class-transformer'
import { FingerprintConfigDto } from './scraper-request.dto.js'

export class FetchRequestDto {
  @IsUrl({ require_tld: false })
  public url!: string

  @IsIn(['http', 'playwright'])
  public engine!: 'http' | 'playwright'

  @IsOptional()
  @IsInt()
  @Min(1)
  public timeoutSecs?: number

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FingerprintConfigDto)
  public fingerprint?: FingerprintConfigDto

  @IsOptional()
  @IsString()
  public locale?: string

  @IsOptional()
  @IsString()
  public timezoneId?: string

  @IsOptional()
  @IsBoolean()
  public debug?: boolean
}
