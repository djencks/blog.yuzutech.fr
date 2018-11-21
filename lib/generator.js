'use strict'

/**
 * Blog Generator based on Antora
 */
const aggregateContent = require('@antora/content-aggregator')
const buildNavigation = require('@antora/navigation-builder')
const buildPlaybook = require('@antora/playbook-builder')
const classifyContent = require('@antora/content-classifier')
const convertDocuments = require('@antora/document-converter')
const publishSite = require('@antora/site-publisher')
const mapSite = require('@antora/site-mapper')
const produceRedirects = require('@antora/redirect-producer')

const createConverter = require('./create-converter')
const { resolveConfig: resolveAsciiDocConfig } = require('@antora/asciidoc-loader')
const createPageComposer = require('@antora/page-composer')
const loadUi = require('@antora/ui-loader')
const { getTags: getTags, getUrl: getTagUrl } = require('./tags')

async function generateSite (args, env) {
  const playbook = buildPlaybook(args, env)
  const [contentCatalog, uiCatalog] = await Promise.all([
    aggregateContent(playbook).then((contentAggregate) => classifyContent(playbook, contentAggregate)),
    loadUi(playbook),
  ])
  const asciidocConfig = resolveAsciiDocConfig(playbook)
  asciidocConfig.converter = createConverter
  const pages = convertDocuments(contentCatalog, asciidocConfig)
  const navigationCatalog = buildNavigation(contentCatalog, asciidocConfig)
  const composePage = createPageComposer(playbook, contentCatalog, uiCatalog, env)
  pages.forEach((page) => composePage(page, contentCatalog, navigationCatalog))
  const siteFiles = mapSite(playbook, pages).concat(produceRedirects(playbook, contentCatalog))
  if (playbook.site.url) siteFiles.push(composePage(create404Page()))
  const tags = getTags(contentCatalog)
  const articles = contentCatalog.getFiles().filter(file => file.asciidoc && file.src.basename !== 'index.adoc')
  tags.forEach((tag) => {
    const articlesWithTag = articles.filter(file => {
      if (file.asciidoc && file.asciidoc.attributes && file.asciidoc.attributes['page-tags']) {
        return file.asciidoc.attributes['page-tags'].split(',').map(tag => tag.trim()).includes(tag)
      }
      return false;
    })
    siteFiles.push(composePage(createTagPage(tag, articlesWithTag), contentCatalog, navigationCatalog))
  })
  siteFiles.push(composePage(createIndexPage(tags, articles), contentCatalog, navigationCatalog))
  const siteCatalog = { getFiles: () => siteFiles }
  return publishSite(playbook, [contentCatalog, uiCatalog, siteCatalog])
}

function create404Page () {
  return {
    title: 'Page Not Found',
    mediaType: 'text/html',
    src: { stem: '404' },
    out: { path: '404.html' },
    pub: { url: '/404.html', rootPath: '' },
  }
}

function createTagPage (tag, files) {
  return {
    title: `Blog / ${tag} - Yuzu tech`,
    version: '1.0',
    mediaType: 'text/html',
    contents: files,
    asciidoc: {
      attributes: {
        'page-layout': 'tag',
        'page-tag': tag
      }
    },
    src: {
      module: 'ROOT',
      component: 'blog',
      version: '1.0',
    },
    out: { path: `blog/1.0/${getTagUrl(tag)}` },
    pub: {
      url: `/blog/1.0/${getTagUrl(tag)}`,
      moduleRootPath: '.',
      rootPath: '../../../..'
    },
  }
}

function createIndexPage (tags, files) {
  return {
    title: 'Blog - Yuzu tech',
    version: '1.0',
    mediaType: 'text/html',
    contents: files,
    asciidoc: {
      attributes: {
        'page-layout': 'index',
        'page-tags': tags
      }
    },
    src: {
      module: 'ROOT',
      component: 'blog',
      version: '1.0',
    },
    out: { path: 'blog/1.0/index.html' },
    pub: {
      url: '/blog/1.0/index.html',
      moduleRootPath: '.',
      rootPath: '../..'
    },
  }
}

module.exports = generateSite