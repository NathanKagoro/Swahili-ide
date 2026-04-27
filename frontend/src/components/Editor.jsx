import MonacoEditor from '@monaco-editor/react'

export default function Editor({ code, onChange, height = '55vh', theme = 'vs-dark', fontSize = 14 }) {
  return (
    <MonacoEditor
      height={height}
      defaultLanguage="python"
      value={code}
      onChange={(value) => onChange(value || '')}
      theme={theme}
      options={{
        minimap: { enabled: false },
        fontSize,
        wordWrap: 'on',
      }}
    />
  )
}
