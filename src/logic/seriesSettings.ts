export type SeriesStyle = 'overlay' | 'poster' | 'below'

export interface SeriesDisplayOptions {
  showPlays: boolean
  showDanmaku: boolean
  showEpisodes: boolean
  showAirDate: boolean
  detailsTrigger: 'hover' | 'always'
  coverFit: 'cover' | 'contain'
  titleLines: 'one' | 'two' | 'full'
}

export function defaultSeriesDisplayOptions(): SeriesDisplayOptions {
  return {
    showPlays: true,
    showDanmaku: true,
    showEpisodes: true,
    showAirDate: true,
    detailsTrigger: 'hover',
    coverFit: 'cover',
    titleLines: 'two',
  }
}

export function defaultSeriesStyles(): Record<SeriesStyle, SeriesDisplayOptions> {
  return {
    overlay: defaultSeriesDisplayOptions(),
    poster: defaultSeriesDisplayOptions(),
    below: defaultSeriesDisplayOptions(),
  }
}

export function parseSeriesStyles(input: unknown): Record<SeriesStyle, SeriesDisplayOptions> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid setting: seriesStyles')
  const result = defaultSeriesStyles()
  const choices = { detailsTrigger: ['hover', 'always'], coverFit: ['cover', 'contain'], titleLines: ['one', 'two', 'full'] }
  for (const style of Object.keys(result) as SeriesStyle[]) {
    const value = (input as Record<string, unknown>)[style]
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error(`Invalid setting: seriesStyles.${style}`)
    for (const key of Object.keys(result[style]) as (keyof SeriesDisplayOptions)[]) {
      const supplied = (value as Record<string, unknown>)[key]
      const valid = key in choices
        ? choices[key as keyof typeof choices].includes(supplied as string)
        : typeof supplied === 'boolean'
      if (!valid)
        throw new Error(`Invalid setting: seriesStyles.${style}.${key}`)
      Object.assign(result[style], { [key]: supplied })
    }
  }
  return result
}
