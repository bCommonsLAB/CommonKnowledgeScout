import React from 'react'

const config = {
  logo: <span>CommonKnowledgeScout Docs</span>,
  project: {
    link: 'https://github.com/bCommonsLAB/CommonKnowledgeScout'
  },
  docsRepositoryBase: 'https://github.com/bCommonsLAB/CommonKnowledgeScout/tree/main',
  useNextSeoProps() {
    return {
      titleTemplate: '%s – CommonKnowledgeScout'
    }
  },
  footer: {
    text: 'CommonKnowledgeScout Documentation'
  }
}

export default config


