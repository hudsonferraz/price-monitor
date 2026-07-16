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
    "Salve buscas de itens no Facebook Marketplace. Quando novos anúncios aparecerem dentro da sua faixa de preço, eles aparecem no painel.",
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


  apiErrorUnauthorized: "Entre para continuar.",
  apiErrorSearchNotFound: "Busca salva nao encontrada.",
  apiErrorSearchIdRequired: "O id da busca e obrigatorio.",
  apiErrorSearchDisabled: "Esta busca esta desativada. Ative-a antes de fazer poll.",
  apiErrorSearchDeleteActivePoll:
    "Um poll esta em andamento para esta busca. Tente excluir novamente em um minuto.",
  apiErrorSearchDeleteCancelFailed:
    "Nao foi possivel cancelar o poll pendente. Tente novamente em instantes.",
  apiErrorAlertNotFound: "Alerta nao encontrado.",
  apiErrorUserNotFound: "Usuario nao encontrado.",
  apiErrorValidationFailed: "Alguns campos sao invalidos. Revise o formulario e tente novamente.",
  apiErrorNoPreferenceFields: "Nenhum campo de preferencia valido foi enviado.",
  apiErrorInvalidPreferredLocale: "O idioma deve ser ingles ou portugues.",
  apiErrorRedisNotConfigured:
    "Redis nao esta configurado. Inicie o Docker e o worker local para habilitar polling.",
  apiErrorPollQueueFailed:
    "Falha ao enfileirar o poll. Verifique se Redis e o worker estao rodando.",
  apiErrorWorkerOffline:
    "Worker local nao esta rodando. Abra um segundo terminal e rode: npm run worker:dev — depois tente Poll now de novo.",
  apiErrorWorkerStale:
    "Heartbeat do worker local esta antigo (o worker pode ter parado). Reinicie com: npm run worker:dev — depois tente Poll now de novo.",
  apiErrorUnknown: "Algo deu errado. Tente novamente.",


  workerStatusTitle: "Worker local",
  workerStatusOnline: "Worker online e escrevendo heartbeats. Os polls devem rodar localmente.",
  workerStatusStale:
    "Heartbeat do worker esta antigo. Reinicie o worker com: npm run worker:dev",
  workerStatusOffline: "Worker parou corretamente. Inicie de novo com: npm run worker:dev",
  workerStatusMissing:
    "Nenhum worker local conectado ainda. Abra um segundo terminal e rode: npm run worker:dev",
  workerStatusId: "Worker: {id}",
  workerStatusLastSeen: "Ultimo sinal: {date}",
  workerStatusRuntime: "Runtime",
  workerStatusFacebookSession: "Sessao do Facebook",
  workerStatusLastSuccess: "Ultimo scrape bem-sucedido",
  workerStatusLastFailure: "Ultima falha",
  workerStatusNoSuccess: "Nenhum scrape bem-sucedido ainda.",
  workerStatusNoFailure: "Nenhum poll com falha registrado.",
  workerStatusSuccessSummary: "{date} - {listings} anuncio(s), {alerts} alerta(s){duration}",
  workerStatusFailureSummary: "{date} - {issue}. Polls com falha em 24h: {failedPolls}",
  workerFacebookSessionUnknown: "Desconhecido",
  workerFacebookSessionOk: "Confirmada",
  workerFacebookSessionUnverified: "Ainda nao confirmada",
  workerFacebookSessionNeedsLogin: "Precisa de login",
  workerFacebookSessionNotConfigured: "Nao configurada",
  workerFacebookSessionModeProfile: "Perfil do navegador",
  workerFacebookSessionModeNone: "Nao configurada",
  marketplaceLocationHint:
    "Os resultados seguem a região da sua conta Facebook — os anúncios aparecem perto de onde sua sessão está logada, não de uma cidade escolhida no app.",

  facebookSessionTitle: "Sessão do Facebook precisa ser renovada",
  facebookSessionDescription:
    "Polls recentes falharam porque o worker local perdeu o login do Facebook.",
  facebookSessionStep1:
    "Rode npm run facebook:login e entre no Facebook no navegador visivel.",
  facebookSessionStep2: "Complete 2FA, checkpoint ou qualquer prompt de confirmacao.",
  facebookSessionStep3:
    "Abra o Marketplace nesse navegador e confirme que os anuncios aparecem.",
  facebookSessionStep4: "Volte ao terminal, pressione Enter e reinicie npm run worker:dev se precisar.",

  searchKeywords: "Palavras-chave",
  searchPriceRange: "Faixa de preço",
  searchPollEvery: "Poll a cada",
  searchMaxPerPoll: "Máx. por poll",
  searchLastAttempted: "Última tentativa",
  searchLastSuccessfulPoll: "Último poll bem-sucedido: {date}",
  searchNoSuccessfulPollYet: "Nenhum poll bem-sucedido ainda.",
  searchConsecutiveFailures: "{count} falha(s) consecutiva(s)",
  searchSessionFailureHint: "A sessão do Facebook provavelmente precisa ser renovada.",
  searchReliabilityHealthy: "Polling saudável. Último poll bem-sucedido: {date}",
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
    "Limites maiores demoram mais para extrair e consomem mais memória na sua máquina local.",
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
    "Sessao do Facebook expirou ou esta ausente no worker. Rode npm run facebook:login localmente e confirme que o Marketplace carrega.",
  pollErrorCheckpoint:
    "Facebook enviou o worker para um checkpoint. Rode npm run facebook:login localmente e resolva o prompt.",
  pollErrorNoListings:
    "Facebook carregou, mas o worker nao conseguiu extrair anuncios do Marketplace. Tente uma busca mais ampla ou atualize a sessao se isso se repetir.",  pollErrorTimeout:
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
  pollCooldown: "Aguarde {minutes} minuto(s) antes de fazer poll desta busca novamente.",
  pollQueueQueued:
    "Poll na fila. O worker pode levar ate um minuto para iniciar e os resultados aparecem em seguida.{positionNote} Atualizando automaticamente.",
  pollQueueQueuedBehindNamed:
    'Poll na fila — aguardando "{searchName}" terminar primeiro (um poll por vez).{positionNote} Atualizando automaticamente.',
  pollQueueQueuedBehindGeneric:
    "Poll na fila — aguardando outra busca terminar primeiro (um poll por vez).{positionNote} Atualizando automaticamente.",
  pollQueuePositionNote: " Voce esta na posicao #{position} da fila.",
  pollQueueAlreadyRunning: "Um poll ja esta em andamento para esta busca.",
  pollQueueAlreadyQueuedBehindNamed:
    'Poll ja na fila — aguardando "{searchName}" terminar primeiro (um poll por vez).',
  pollQueueAlreadyQueuedBehindGeneric:
    "Poll ja na fila — aguardando outra busca terminar primeiro (um poll por vez).",
  pollQueueAlreadyQueued: "Um poll ja esta na fila. O worker pode levar ate um minuto para iniciar.",
  pollQueueAlreadyInProgress: "Um poll ja esta em progresso para esta busca.",

  diagnosticsSessionTitle: "Sessao do Facebook expirou",
  diagnosticsSessionDescription:
    "Polls recentes chegaram ao worker, mas o Facebook pediu login novamente. Rode npm run facebook:login localmente e resolva o prompt. Polls com falha nas ultimas 24h: {failedPolls}.",
  diagnosticsCheckpointTitle: "Checkpoint do Facebook detectado",
  diagnosticsCheckpointDescription:
    "O Facebook enviou a sessao do worker para um checkpoint. Rode npm run facebook:login localmente, resolva o prompt e tente de novo. Polls com falha nas ultimas 24h: {failedPolls}.",
  diagnosticsNoListingsTitle: "Nenhum anuncio extraido",
  diagnosticsNoListingsDescription:
    "O Facebook carregou, mas o scraper nao encontrou dados de anuncios do Marketplace. Isso pode acontecer com buscas muito restritas, mudancas no layout ou sessao antiga. Polls com falha nas ultimas 24h: {failedPolls}.",
  diagnosticsTimeoutTitle: "Poll expirou",
  diagnosticsTimeoutDescription:
    "O worker iniciou o poll, mas nao terminou a tempo. O worker local pode estar ocupado, parado ou o Facebook pode estar lento. Polls com falha nas ultimas 24h: {failedPolls}.",
  diagnosticsUnknownTitle: "Problema de polling detectado",
  diagnosticsUnknownDescription:
    "Um poll recente falhou com erro nao classificado. Confira o historico de polls e os logs do worker local. Polls com falha nas ultimas 24h: {failedPolls}.",
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
  alertsBaselineBanner:
    "Varredura inicial concluida — mostrando todos os resultados deste primeiro poll (ate {limit} por poll). Polls futuros destacam anuncios novos e quedas de preco.",
  alertsBaselineResults: "Resultados da linha de base ({count})",
  alertsNewSincePoll: "Novos desde o último poll ({count})",
  alertsPreviousListings: "Anúncios anteriores ({count})",
  alertsAllMatches: "Todos os resultados ({count})",
  alertsWhyKeyword: "Palavra-chave: {keyword}",
  alertsWhyPriceRange: "Dentro da faixa de preço",
  alertsWhyBaseline: "Resultado da linha de base",
  alertsWhyNew: "Novo desde o último poll",
  alertsWhyLowestSeen: "Menor preco visto",
  alertsWhyBelowAverage: "Abaixo da media recente ({average})",
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
