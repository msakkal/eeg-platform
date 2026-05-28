import { useMemo } from 'react'
import EEGViewer from './EEGViewer'
import { generateDemoTrace } from '@/engine/waveforms'
import { makeTimeAxis, SAMPLE_RATE } from '@/engine/signalGenerator'

export default function DemoTraceViewer({
  patternId,
  data = null,
  color = '#00FFB0',
  label = 'EEG',
  height = 84,
  sampleRate = SAMPLE_RATE,
  className = '',
  polarity = 'positive-up',
}) {
  const signal = useMemo(() => {
    if (data) return data
    if (!patternId) return null
    return generateDemoTrace(patternId, sampleRate)
  }, [data, patternId, sampleRate])

  const timeAxis = useMemo(() => (
    signal ? makeTimeAxis(signal.length, sampleRate) : []
  ), [signal, sampleRate])

  if (!signal) return null

  return (
    <EEGViewer
      channels={[{ label, data: signal }]}
      timeAxis={timeAxis}
      isPlaying={false}
      scaleMode="global-fit"
      signalColor={color}
      channelHeight={Math.max(40, height - 18)}
      footerHeight={18}
      leftLabelWidth={0}
      showChannelLabels={false}
      showCalibration={false}
      showTimeLabels
      theme="midnight"
      polarity={polarity}
      className={className}
    />
  )
}
