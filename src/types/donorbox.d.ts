import 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'dbox-widget': {
        campaign: string
        type: string
        'enable-auto-scroll'?: string
        [key: string]: string | undefined
      }
    }
  }
}
