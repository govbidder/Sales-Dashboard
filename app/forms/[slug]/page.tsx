import type { Metadata } from "next"
import { PublicFormView } from "@/components/views/public-form-view"

export const metadata: Metadata = {
  title: "Form",
}

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <PublicFormView slug={slug} />
}
