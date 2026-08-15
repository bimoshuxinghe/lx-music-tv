import { NativeEventEmitter, NativeModules } from 'react-native'

const { AISharjeck } = NativeModules

export interface AISearchCommand {
  keyword: string
  singerName: string
  songName: string
}

export const registerAISharjeck = () => {
  AISharjeck?.register()
}

export const getPendingCommand = (): Promise<AISearchCommand | null> => {
  if (!AISharjeck?.getPendingCommand) return Promise.resolve(null)
  return AISharjeck.getPendingCommand()
}

export const onAISearch = (handler: (command: AISearchCommand) => void): (() => void) => {
  if (!AISharjeck) return () => {}
  const eventEmitter = new NativeEventEmitter(AISharjeck)
  const eventListener = eventEmitter.addListener('ais-search', (event: AISearchCommand) => {
    handler(event)
  })

  return () => {
    eventListener.remove()
  }
}
