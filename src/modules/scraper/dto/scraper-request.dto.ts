import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsIn,
  Min,
  Max,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

export class FingerprintConfigDto {
  @IsOptional()
  @IsBoolean()
  public generate?: boolean

  @IsOptional()
  @IsString()
  public userAgent?: string

  @IsOptional()
  @IsString()
  public locale?: string

  @IsOptional()
  @IsString()
  public timezoneId?: string

  @IsOptional()
  @IsBoolean()
  public rotateOnAntiBot?: boolean

  @IsOptional()
  @IsObject()
  public generator?: {
    browsers: string[]
  }
}

export class ScraperRequestDto {
  @IsString()
  public url!: string

  @IsOptional()
  @IsIn(['cheerio', 'playwright'])
  public mode?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  public taskTimeoutSecs?: number

  @IsOptional()
  @IsString()
  public locale?: string

  @IsOptional()
  @IsString()
  public dateLocale?: string

  @IsOptional()
  @IsString()
  public timezoneId?: string

  @IsOptional()
  @IsBoolean()
  public blockTrackers?: boolean

  @IsOptional()
  @IsBoolean()
  public blockHeavyResources?: boolean

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FingerprintConfigDto)
  public fingerprint?: FingerprintConfigDto
}
