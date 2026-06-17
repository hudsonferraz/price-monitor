export const messages = {
  appName: "price-monitor",
  appDescription: "Alertas de ofertas no Facebook Marketplace para o Brasil",

  navDashboard: "Painel",
  navSignIn: "Entrar",
  navSignOut: "Sair",
  languageLabel: "Idioma",

  homeEyebrow: "Facebook Marketplace · Brasil",
  homeTitle: "Receba alertas quando ofertas usadas baterem com sua busca",
  homeDescription:
    "Salve buscas de itens no Facebook Marketplace. Quando novos anúncios aparecerem dentro da sua faixa de preço, você verá no painel e será notificado.",
  homeGetStarted: "Começar",
  homeGoToDashboard: "Ir para o painel",
  homeFeatureSaveTitle: "Salvar buscas",
  homeFeatureSaveDescription: "Palavras-chave e preço mínimo/máximo opcional em reais.",
  homeFeaturePollingTitle: "Monitoramento automático",
  homeFeaturePollingDescription:
    "O worker verifica o Marketplace no intervalo que você definir.",
  homeFeatureAlertsTitle: "Alertas de ofertas",
  homeFeatureAlertsDescription: "Novos resultados aparecem no feed — sem atualizar manualmente.",

  signInTitle: "Entrar",
  signInDescription:
    "Entre com Google ou GitHub para acessar suas buscas salvas e alertas.",
  signInFailedTitle: "Falha ao entrar",
  signInBackHome: "Voltar ao início",
  signInGoogle: "Continuar com Google",
  signInGitHub: "Continuar com GitHub",

  dashboardTitle: "Painel",
  dashboardDescription:
    "Monitore buscas no Facebook Marketplace e revise alertas de novos anúncios.",
  dashboardYourSearches: "Suas buscas",
  dashboardNewSearch: "Nova busca",
  dashboardNoSearches:
    "Nenhuma busca salva ainda. Crie uma abaixo para começar a monitorar o Facebook Marketplace.",

  notificationsTitle: "Notificações",
  notificationsDescription:
    "Receba e-mail quando novos anúncios do Facebook Marketplace baterem com suas buscas.",
  notificationsEmailLabel: "Enviar e-mail sobre novos resultados",
  notificationsEmailHint: "Requer Resend configurado no worker.",
  notificationsEnabled: "Alertas por e-mail ativados.",
  notificationsDisabled: "Alertas por e-mail desativados.",
  notificationsUpdateFailed: "Falha ao atualizar configurações de notificação",

  marketplaceLocationHint:
    "Os resultados seguem a região da sua conta Facebook — os anúncios aparecem perto de onde sua sessão está logada, não de uma cidade escolhida no app.",

  systemStatusTitle: "Status do sistema",
  systemStatusWorker: "Worker",
  systemStatusWorkerOnline: "Online",
  systemStatusWorkerOffline: "Offline ou acordando",
  systemStatusWorkerNotConfigured: "Não configurado",
  systemStatusWorkerResponse: "{duration} de resposta",
  systemStatusFailedPolls: "Polls com falha (24h)",
  systemStatusAvgPoll: "Média de poll bem-sucedido",
  systemStatusFreeTierHint:
    "No plano gratuito do Render o worker dorme após inatividade. O primeiro poll após acordar pode levar 1–2 minutos.",

  facebookSessionTitle: "Sessão do Facebook precisa ser renovada",
  facebookSessionDescription:
    "Polls recentes falharam porque o worker perdeu o login do Facebook. Isso costuma acontecer a cada poucas semanas no Render.",
  facebookSessionStep1:
    "No seu PC, rode npm run save:facebook-session e entre no Facebook.",
  facebookSessionStep2: "Abra Render → serviço worker → Environment → Secret Files.",
  facebookSessionStep3:
    "Substitua /etc/secrets/facebook-storage-state.json pelo conteúdo do novo arquivo.",
  facebookSessionStep4: "Faça redeploy do worker e clique em Poll now novamente.",
  facebookSessionDocs: "Guia completo em render-deploy.md",

  statsTitle: "Estatísticas das buscas",
  statsDescription: "Preço médio e quantidade de anúncios dos polls bem-sucedidos recentes.",
  statsEmpty: "Execute pelo menos um poll bem-sucedido para ver estatísticas.",
  statsLatestAverage: "Preço médio recente",
  statsPriceRange: "Faixa de preço recente",
  statsSuccessfulPolls: "Polls bem-sucedidos",
  statsListingsOverTime: "Anúncios encontrados ao longo do tempo",
  statsNoPriceData: "Nenhum anúncio com preço no último poll.",
  statsPollCount: "{count} polls",

  searchKeywords: "Palavras-chave",
  searchPriceRange: "Faixa de preço",
  searchPollEvery: "Poll a cada",
  searchMaxPerPoll: "Máx. por poll",
  searchLastPolled: "Último poll",
  searchNever: "Nunca",
  searchListingsCount: "{count} anúncio(s)",
  searchEnabled: "Ativo",
  searchDisabled: "Inativo",
  searchPollNow: "Poll now",
  searchQueuing: "Enfileirando...",
  searchPolling: "Poll em andamento...",
  searchEdit: "Editar",
  searchDisable: "Desativar",
  searchEnable: "Ativar",
  searchDelete: "Excluir",
  searchDeleteConfirm: "Excluir esta busca salva?",
  searchMinutes: "{count} min",
  searchListingsPerPoll: "{count} anúncios",

  searchFormName: "Nome",
  searchFormNamePlaceholder: "Ofertas iPhone 13",
  searchFormKeywords: "Palavras-chave",
  searchFormKeywordsPlaceholder: "iphone 13",
  searchFormMinPrice: "Preço mínimo (R$)",
  searchFormMaxPrice: "Preço máximo (R$)",
  searchFormPollInterval: "Intervalo de poll (minutos)",
  searchFormListingLimit: "Máx. anúncios por poll",
  searchFormListingLimitHint:
    "Limites maiores demoram mais para extrair e podem ser menos confiáveis no worker gratuito.",
  searchFormEnabled: "Ativo",
  searchFormCreate: "Criar busca",
  searchFormUpdate: "Atualizar busca",
  searchFormSaving: "Salvando...",
  searchFormCancel: "Cancelar",
  searchFormSaveFailed: "Falha ao salvar busca",

  pollRecentTitle: "Polls recentes",
  pollCheckingMarketplace:
    "Verificando Facebook Marketplace — costuma levar 1–2 minutos.",
  pollListingsSummary: "{listings} anúncios · {alerts} alerta(s) novo(s)",
  pollErrorSession:
    "Sessão do Facebook expirou ou está ausente no worker. Atualize facebook-storage-state.json no Render.",
  pollErrorTimeout:
    "Poll expirou. O worker pode ter estado dormindo ou o Facebook demorou demais. Tente Poll now novamente.",
  pollErrorUnknown: "Poll falhou por motivo desconhecido.",

  pollStatusQueuing: "Enfileirando",
  pollStatusQueued: "Na fila",
  pollStatusRunning: "Em andamento",
  pollStatusSuccess: "Concluído",
  pollStatusFailed: "Falhou",
  pollStatusSending: "Enviando solicitação de poll...",
  pollStatusQueuedAuto: "Poll na fila. Atualizando automaticamente.",
  pollStatusSuccessSummary: "Encontrados {listings} anúncio(s), {alerts} novo(s).",
  pollStatusFailedGeneric: "Poll falhou. Tente novamente em alguns minutos.",
  pollStatusFailedQueue: "Falha ao enfileirar poll",
  pollStatusTimeout: "Poll está demorando mais que o esperado. Atualize a página em um minuto.",

  alertsNoListings:
    "Nenhum anúncio ainda. Clique em Poll now para buscar no Facebook Marketplace.",
  alertsListingsTitle: "Anúncios ({count})",
  alertsShow: "Mostrar",
  alertsHide: "Ocultar",
  alertsSort: "Ordenar",
  alertsClearAll: "Limpar tudo",
  alertsClearing: "Limpando...",
  alertsClearConfirm: "Remover todos os anúncios desta busca do painel?",
  alertsDismiss: "Dispensar",
  alertsDismissing: "Removendo...",
  alertsViewFacebook: "Ver no Facebook",
  alertsNoImage: "Sem imagem",
  alertsPriceDrop: "Queda de preço · era {price}",
  alertsFirstSeen: "Visto pela 1ª vez {date}",
  alertsLastSeen: "Visto por último {date}",
  alertsFirstPollBanner:
    "Primeiro poll — mostrando todos os resultados da última varredura (até {limit} por poll).",
  alertsNewSincePoll: "Novos desde o último poll ({count})",
  alertsPreviousListings: "Anúncios anteriores ({count})",
  alertsAllMatches: "Todos os resultados ({count})",
  alertsNoNewSincePoll:
    "Nenhum anúncio novo desde o último poll. Resultados anteriores abaixo.",
  alertsShowAll: "Mostrar todos ({count})",
  alertsShowLess: "Mostrar menos",
  alertsSortNewest: "Mais recentes",
  alertsSortOldest: "Mais antigos",
  alertsSortPriceAsc: "Preço: menor para maior",
  alertsSortPriceDesc: "Preço: maior para menor",

  signInErrorSignin: "Falha ao entrar. Tente outra conta ou provedor.",
  signInErrorOAuthSignin: "Não foi possível iniciar login com esse provedor. Tente novamente.",
  signInErrorOAuthCallback: "Login foi interrompido. Tente novamente.",
  signInErrorOAuthCallbackError: "Login foi interrompido. Tente novamente.",
  signInErrorOAuthCreateAccount: "Não foi possível criar sua conta. Tente novamente.",
  signInErrorEmailCreateAccount: "Não foi possível criar sua conta. Tente novamente.",
  signInErrorCallback: "Falha ao entrar. Tente novamente.",
  signInErrorOAuthAccountNotLinked:
    "Este e-mail já está vinculado a outro método de login. Use o mesmo provedor do cadastro original.",
  signInErrorEmailSignin: "Não foi possível enviar o e-mail de login. Tente novamente.",
  signInErrorCredentialsSignin: "Falha ao entrar. Verifique seus dados e tente novamente.",
  signInErrorSessionRequired: "Entre para continuar.",
  signInErrorConfiguration: "Login não está configurado corretamente. Contate o administrador.",
  signInErrorAccessDenied: "Acesso negado. Você pode ter cancelado o login ou não ter permissão.",
  signInErrorVerification: "O link de login expirou ou já foi usado.",
  signInErrorDefault: "Não foi possível entrar. Tente novamente.",
} as const;

export type MessageKey = keyof typeof messages;
