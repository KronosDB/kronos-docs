import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page"
import defaultMdxComponents from "fumadocs-ui/mdx"
import { Card, Cards } from "fumadocs-ui/components/card"
import { Callout } from "fumadocs-ui/components/callout"
import { Step, Steps } from "fumadocs-ui/components/steps"
import { Tab, Tabs } from "fumadocs-ui/components/tabs"
import { File, Files, Folder } from "fumadocs-ui/components/files"
import { Accordion, Accordions } from "fumadocs-ui/components/accordion"
import { TypeTable } from "fumadocs-ui/components/type-table"
import {
  GroupCommitAnimation,
  IndexingAnimation,
  KeyLookupAnimation,
  LeapfrogAnimation,
  MergeAnimation,
  PositionSetAnimation,
  QueryAnimation,
  SegmentsAnimation,
} from "@/components/explainer/storage"
import {
  AppendChart,
  ClusterOneZoneChart,
  ClusterThreeZoneChart,
  ConditionalAppendChart,
  TagReadChart,
  WholeLogReadChart,
} from "@/components/benchmarks/charts"
import { notFound } from "next/navigation"
import { source } from "@/lib/source"

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) notFound()
  const MDX = page.data.body
  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={{
            ...defaultMdxComponents,
            Card, Cards, Callout,
            Step, Steps,
            Tab, Tabs,
            File, Files, Folder,
            Accordion, Accordions,
            TypeTable,
            SegmentsAnimation,
            GroupCommitAnimation,
            IndexingAnimation,
            MergeAnimation,
            QueryAnimation,
            PositionSetAnimation,
            KeyLookupAnimation,
            LeapfrogAnimation,
            AppendChart,
            ConditionalAppendChart,
            TagReadChart,
            WholeLogReadChart,
            ClusterOneZoneChart,
            ClusterThreeZoneChart,
          }}
        />
      </DocsBody>
    </DocsPage>
  )
}

export function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) notFound()
  return { title: page.data.title, description: page.data.description }
}
