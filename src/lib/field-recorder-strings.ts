/**
 * Field-recorder UI strings.
 *
 * The field recorder lives at gogreenstreets.org/record/[slug] and serves
 * supporters in whatever languages a campaign enables (`supported_languages`).
 * Campaign-specific copy (consent paragraphs, confirmation message, etc.)
 * is stored language-keyed on `wmu_campaigns` (consent_copy, invite_copy,
 * confirmation_copy). The structural UI strings below — buttons, labels,
 * headings, error messages — are static and live here.
 *
 * All keys must exist on `en`. Every other language falls back to English
 * if missing, so partial translations are safe.
 *
 * Use `{0}`, `{1}`, ... for runtime interpolation: `t(lang, 'prompt_n_of_n', '2', '4')`.
 */

export const RECORDER_STRINGS_EN = {
  language_label: 'Language',

  // Screen 1: intro + mode selector
  mode_label: 'How would you like to share?',
  mode_record_title: 'Record a video now',
  mode_record_subtitle: 'Use your camera to record short answers to a few prompts.',
  mode_upload_title: 'Upload a video I already made',
  mode_upload_subtitle:
    'Already filmed something? Share the video file from your phone or computer.',
  get_started: 'Get started',

  // Screen 2: consent
  before_you_record: 'Before you record',
  review_uses: 'Please review how your responses will be used.',
  what_this_is_heading: 'What this is',
  lets_go: "Let's go",
  privacy_link: 'Read our full privacy policy',

  // Screen 3: participant info
  info_heading: 'A little about you',
  info_subhead_optional: 'This is optional — you can skip ahead if you prefer.',
  info_subhead_required:
    "We'll use your email to credit your story and let you know if it's selected.",
  email_label_optional: 'Your email address (optional)',
  email_label_required: 'Your email address',
  email_helper:
    "We'll use this to follow up and invite you to download the free Shift app.",
  newsletter_label: 'Add me to the Green Streets newsletter',
  continue_btn: 'Continue',
  continue_without_email: 'Continue without email',

  // Recording screens
  exit: '← Exit',
  back: '← Back',
  step_n_of_n: 'Step {0} of {1}',
  prompt_n_of_n: 'Prompt {0} of {1}',
  prefer_voice_only: 'Prefer voice only?',
  switch_to_video: 'Switch to video',
  recording_audio: 'Recording audio...',
  voice_only_mode: 'Voice only mode',
  almost_at_limit: 'Almost at the limit',
  camera_required: 'Camera access is required',
  camera_required_helper:
    'Please allow camera and microphone access in your browser settings, then tap below.',
  try_again: 'Try again',
  tap_to_record: 'Tap to record',
  stop_recording: 'Stop recording',
  skip_prompt: 'Skip this prompt',
  happy_with_this: 'Happy with this? Or record again.',
  use_this_one: 'Use this one →',
  record_again: 'Record again',
  n_seconds_max: '{0}s max',

  // Upload screen
  upload_share_video_heading: 'Share your video',
  upload_inspiration_intro:
    "We'd love to hear what's behind the moments you captured. Some things we love hearing about:",
  upload_size_guidance:
    'One video, up to 100 MB. MP4 or MOV from your phone work great. Under 5 minutes plays best.',
  upload_pick_label: 'Tap to pick a video',
  upload_accept_helper: 'MP4, MOV, or WEBM · up to 100 MB',
  upload_choose_different: 'Choose a different video',
  upload_submit_btn: 'Submit my video',
  upload_error_mime:
    'Please upload a video file — MP4 or MOV from your phone work great.',
  upload_error_size:
    "That video is over 100 MB. Try lowering the quality in your phone's camera settings, or trim it to about 60–90 seconds.",
  upload_already_submitted:
    "Looks like you've already submitted to this campaign — thank you.",
  upload_failed_default: 'Upload failed. Please try again.',

  // Uploading + confirmation
  submitting: 'Submitting your responses...',
  dont_close_page: "Please don't close this page.",
  confirmation_default_title: 'Thank you for sharing your story',
  confirmation_submitted_label: 'Submitted',
  confirmation_one_upload: '1 video upload',
  confirmation_prompts_answered: 'Prompts answered',
  confirmation_total_time: 'Total recording time',
  confirmation_campaign_label: 'Campaign',
  shift_promo_heading: 'Keep tracking your trips',
  shift_promo_body:
    'Download Shift, the free app that rewards you for walking, biking, and taking transit.',
  get_shift: 'Get Shift',
  record_another: 'Record another response',
  deletion_link: 'Request deletion of my responses',
} as const

export type RecorderStringKey = keyof typeof RECORDER_STRINGS_EN

const RECORDER_STRINGS_ES: Partial<Record<RecorderStringKey, string>> = {
  language_label: 'Idioma',
  mode_label: '¿Cómo te gustaría compartir?',
  mode_record_title: 'Grabar un video ahora',
  mode_record_subtitle:
    'Usa tu cámara para grabar respuestas cortas a algunas preguntas.',
  mode_upload_title: 'Subir un video que ya hice',
  mode_upload_subtitle:
    '¿Ya grabaste algo? Comparte el archivo de video desde tu teléfono o computadora.',
  get_started: 'Empezar',

  before_you_record: 'Antes de grabar',
  review_uses: 'Por favor revisa cómo se usarán tus respuestas.',
  what_this_is_heading: 'De qué se trata',
  lets_go: 'Vamos',
  privacy_link: 'Lee nuestra política de privacidad completa',

  info_heading: 'Un poco sobre ti',
  info_subhead_optional:
    'Esto es opcional, puedes omitir este paso si prefieres.',
  info_subhead_required:
    'Usaremos tu correo electrónico para acreditar tu historia y avisarte si es seleccionada.',
  email_label_optional: 'Tu correo electrónico (opcional)',
  email_label_required: 'Tu correo electrónico',
  email_helper:
    'Lo usaremos para hacer seguimiento e invitarte a descargar la app gratuita Shift.',
  newsletter_label: 'Suscríbeme al boletín de Green Streets',
  continue_btn: 'Continuar',
  continue_without_email: 'Continuar sin correo electrónico',

  exit: '← Salir',
  back: '← Atrás',
  step_n_of_n: 'Paso {0} de {1}',
  prompt_n_of_n: 'Pregunta {0} de {1}',
  prefer_voice_only: '¿Prefieres solo audio?',
  switch_to_video: 'Cambiar a video',
  recording_audio: 'Grabando audio...',
  voice_only_mode: 'Modo solo audio',
  almost_at_limit: 'Casi en el límite',
  camera_required: 'Se requiere acceso a la cámara',
  camera_required_helper:
    'Por favor permite el acceso a la cámara y al micrófono en la configuración de tu navegador, luego pulsa abajo.',
  try_again: 'Intentar de nuevo',
  tap_to_record: 'Toca para grabar',
  stop_recording: 'Detener grabación',
  skip_prompt: 'Omitir esta pregunta',
  happy_with_this: '¿Te gusta así? O graba de nuevo.',
  use_this_one: 'Usar este →',
  record_again: 'Grabar de nuevo',
  n_seconds_max: '{0}s máx.',

  upload_share_video_heading: 'Comparte tu video',
  upload_inspiration_intro:
    'Nos encantaría saber qué hay detrás de los momentos que captaste. Algunas cosas que nos encanta escuchar:',
  upload_size_guidance:
    'Un video, hasta 100 MB. MP4 o MOV de tu teléfono funcionan muy bien. Menos de 5 minutos se reproduce mejor.',
  upload_pick_label: 'Toca para elegir un video',
  upload_accept_helper: 'MP4, MOV o WEBM · hasta 100 MB',
  upload_choose_different: 'Elegir un video diferente',
  upload_submit_btn: 'Enviar mi video',
  upload_error_mime:
    'Por favor sube un archivo de video — MP4 o MOV de tu teléfono funcionan bien.',
  upload_error_size:
    'Ese video supera los 100 MB. Intenta bajar la calidad en la configuración de la cámara de tu teléfono, o recórtalo a unos 60–90 segundos.',
  upload_already_submitted:
    'Parece que ya enviaste tu historia a esta campaña — ¡gracias!',
  upload_failed_default: 'Falló la subida. Por favor intenta de nuevo.',

  submitting: 'Enviando tus respuestas...',
  dont_close_page: 'Por favor no cierres esta página.',
  confirmation_default_title: 'Gracias por compartir tu historia',
  confirmation_submitted_label: 'Enviado',
  confirmation_one_upload: '1 video subido',
  confirmation_prompts_answered: 'Preguntas respondidas',
  confirmation_total_time: 'Tiempo total grabado',
  confirmation_campaign_label: 'Campaña',
  shift_promo_heading: 'Sigue registrando tus viajes',
  shift_promo_body:
    'Descarga Shift, la app gratuita que te recompensa por caminar, andar en bici y usar el transporte público.',
  get_shift: 'Obtener Shift',
  record_another: 'Grabar otra respuesta',
  deletion_link: 'Solicitar la eliminación de mis respuestas',
}

const RECORDER_STRINGS_PT: Partial<Record<RecorderStringKey, string>> = {
  language_label: 'Idioma',
  mode_label: 'Como você gostaria de compartilhar?',
  mode_record_title: 'Gravar um vídeo agora',
  mode_record_subtitle:
    'Use sua câmera para gravar respostas curtas a algumas perguntas.',
  mode_upload_title: 'Enviar um vídeo que eu já gravei',
  mode_upload_subtitle:
    'Já gravou algo? Compartilhe o arquivo de vídeo do seu telefone ou computador.',
  get_started: 'Começar',

  before_you_record: 'Antes de gravar',
  review_uses: 'Por favor, revise como suas respostas serão usadas.',
  what_this_is_heading: 'Sobre o que é',
  lets_go: 'Vamos lá',
  privacy_link: 'Leia nossa política de privacidade completa',

  info_heading: 'Um pouco sobre você',
  info_subhead_optional:
    'Isso é opcional — você pode pular essa etapa se preferir.',
  info_subhead_required:
    'Usaremos seu e-mail para creditar sua história e avisá-lo se ela for selecionada.',
  email_label_optional: 'Seu e-mail (opcional)',
  email_label_required: 'Seu e-mail',
  email_helper:
    'Usaremos para fazer um acompanhamento e convidá-lo a baixar o app gratuito Shift.',
  newsletter_label: 'Inscreva-me no boletim da Green Streets',
  continue_btn: 'Continuar',
  continue_without_email: 'Continuar sem e-mail',

  exit: '← Sair',
  back: '← Voltar',
  step_n_of_n: 'Etapa {0} de {1}',
  prompt_n_of_n: 'Pergunta {0} de {1}',
  prefer_voice_only: 'Prefere só áudio?',
  switch_to_video: 'Mudar para vídeo',
  recording_audio: 'Gravando áudio...',
  voice_only_mode: 'Modo só áudio',
  almost_at_limit: 'Quase no limite',
  camera_required: 'Acesso à câmera é necessário',
  camera_required_helper:
    'Permita o acesso à câmera e ao microfone nas configurações do seu navegador, então toque abaixo.',
  try_again: 'Tentar novamente',
  tap_to_record: 'Toque para gravar',
  stop_recording: 'Parar gravação',
  skip_prompt: 'Pular esta pergunta',
  happy_with_this: 'Gostou? Ou grave novamente.',
  use_this_one: 'Usar este →',
  record_again: 'Gravar novamente',
  n_seconds_max: '{0}s máx.',

  upload_share_video_heading: 'Compartilhe seu vídeo',
  upload_inspiration_intro:
    'Adoraríamos saber o que há por trás dos momentos que você registrou. Algumas coisas que adoramos ouvir:',
  upload_size_guidance:
    'Um vídeo, até 100 MB. MP4 ou MOV do seu telefone funcionam bem. Menos de 5 minutos toca melhor.',
  upload_pick_label: 'Toque para escolher um vídeo',
  upload_accept_helper: 'MP4, MOV ou WEBM · até 100 MB',
  upload_choose_different: 'Escolher outro vídeo',
  upload_submit_btn: 'Enviar meu vídeo',
  upload_error_mime:
    'Por favor, envie um arquivo de vídeo — MP4 ou MOV do seu telefone funcionam bem.',
  upload_error_size:
    'Esse vídeo passa de 100 MB. Tente diminuir a qualidade nas configurações da câmera do seu celular ou cortá-lo para cerca de 60–90 segundos.',
  upload_already_submitted:
    'Parece que você já enviou sua história para esta campanha — obrigado!',
  upload_failed_default: 'Falha no envio. Por favor, tente novamente.',

  submitting: 'Enviando suas respostas...',
  dont_close_page: 'Por favor, não feche esta página.',
  confirmation_default_title: 'Obrigado por compartilhar sua história',
  confirmation_submitted_label: 'Enviado',
  confirmation_one_upload: '1 vídeo enviado',
  confirmation_prompts_answered: 'Perguntas respondidas',
  confirmation_total_time: 'Tempo total gravado',
  confirmation_campaign_label: 'Campanha',
  shift_promo_heading: 'Continue registrando suas viagens',
  shift_promo_body:
    'Baixe o Shift, o app gratuito que recompensa você por caminhar, pedalar e usar transporte público.',
  get_shift: 'Baixar Shift',
  record_another: 'Gravar outra resposta',
  deletion_link: 'Solicitar a exclusão das minhas respostas',
}

const RECORDER_STRINGS_ZH: Partial<Record<RecorderStringKey, string>> = {
  language_label: '语言',
  mode_label: '您想如何分享？',
  mode_record_title: '立即录制视频',
  mode_record_subtitle: '使用您的摄像头，针对几个问题录制简短的回答。',
  mode_upload_title: '上传我已经录好的视频',
  mode_upload_subtitle: '已经录好了？通过您的手机或电脑分享视频文件。',
  get_started: '开始',

  before_you_record: '在录制之前',
  review_uses: '请查看您的回应将如何被使用。',
  what_this_is_heading: '关于本活动',
  lets_go: '开始吧',
  privacy_link: '查看我们的完整隐私政策',

  info_heading: '关于您',
  info_subhead_optional: '这是可选的，您可以选择跳过。',
  info_subhead_required:
    '我们会使用您的电子邮件来署名您的故事，并在它被选中时通知您。',
  email_label_optional: '您的电子邮件（可选）',
  email_label_required: '您的电子邮件',
  email_helper: '我们将用它来跟进，并邀请您下载免费的 Shift 应用。',
  newsletter_label: '把我加入 Green Streets 邮件订阅列表',
  continue_btn: '继续',
  continue_without_email: '不使用电子邮件继续',

  exit: '← 退出',
  back: '← 返回',
  step_n_of_n: '第 {0} 步，共 {1} 步',
  prompt_n_of_n: '第 {0} 题，共 {1} 题',
  prefer_voice_only: '只录音频？',
  switch_to_video: '切换到视频',
  recording_audio: '正在录音…',
  voice_only_mode: '仅音频模式',
  almost_at_limit: '接近时间上限',
  camera_required: '需要相机访问权限',
  camera_required_helper:
    '请在浏览器设置中允许访问相机和麦克风，然后点击下方按钮。',
  try_again: '重试',
  tap_to_record: '点击开始录制',
  stop_recording: '停止录制',
  skip_prompt: '跳过此题',
  happy_with_this: '满意吗？或者重新录制。',
  use_this_one: '使用这个 →',
  record_again: '重新录制',
  n_seconds_max: '最长 {0} 秒',

  upload_share_video_heading: '分享您的视频',
  upload_inspiration_intro:
    '我们很想听听您所记录的瞬间背后的故事。我们特别想听到的内容包括：',
  upload_size_guidance:
    '一段视频，最多 100 MB。手机的 MP4 或 MOV 格式效果很好。最好不超过 5 分钟。',
  upload_pick_label: '点击选择视频',
  upload_accept_helper: 'MP4、MOV 或 WEBM · 最多 100 MB',
  upload_choose_different: '选择其他视频',
  upload_submit_btn: '提交我的视频',
  upload_error_mime: '请上传视频文件 — 手机的 MP4 或 MOV 格式效果很好。',
  upload_error_size:
    '该视频超过 100 MB。请在手机相机设置中降低画质，或将其修剪到大约 60–90 秒。',
  upload_already_submitted: '看起来您已经向此活动提交过 — 感谢您！',
  upload_failed_default: '上传失败。请重试。',

  submitting: '正在提交您的回应…',
  dont_close_page: '请不要关闭此页面。',
  confirmation_default_title: '感谢您分享您的故事',
  confirmation_submitted_label: '已提交',
  confirmation_one_upload: '已上传 1 个视频',
  confirmation_prompts_answered: '已回答的题目',
  confirmation_total_time: '总录制时长',
  confirmation_campaign_label: '活动',
  shift_promo_heading: '持续记录您的出行',
  shift_promo_body:
    '下载 Shift，这款免费应用会奖励您步行、骑行和搭乘公共交通。',
  get_shift: '获取 Shift',
  record_another: '录制另一个回应',
  deletion_link: '申请删除我的回应',
}

const RECORDER_STRINGS: Record<string, Partial<Record<RecorderStringKey, string>>> = {
  en: RECORDER_STRINGS_EN,
  es: RECORDER_STRINGS_ES,
  pt: RECORDER_STRINGS_PT,
  zh: RECORDER_STRINGS_ZH,
}

/**
 * Resolve a UI string for the active language, falling back to English.
 *
 * `args` are positional substitutions for `{0}`, `{1}`, ... in the string.
 */
export function t(
  lang: string,
  key: RecorderStringKey,
  ...args: string[]
): string {
  const dict = RECORDER_STRINGS[lang] ?? {}
  let value = dict[key] ?? RECORDER_STRINGS_EN[key]
  for (let i = 0; i < args.length; i++) {
    value = value.replace(`{${i}}`, args[i])
  }
  return value
}
