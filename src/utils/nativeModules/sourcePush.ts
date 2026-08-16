import { NativeEventEmitter, NativeModules } from 'react-native'

const { SourcePushModule } = NativeModules

export const startSourcePushServer = (): Promise<number> => SourcePushModule.start()

export const stopSourcePushServer = () => {
  SourcePushModule.stop()
}

export const onSourcePushed = (handler: (script: string) => void): () => void => {
  const eventEmitter = new NativeEventEmitter(SourcePushModule)
  const eventListener = eventEmitter.addListener('source-pushed', event => {
    handler(event.script)
  })

  return () => {
    eventListener.remove()
  }
}
