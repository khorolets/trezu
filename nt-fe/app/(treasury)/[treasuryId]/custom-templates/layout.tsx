import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
    return { title: "Request Templates" };
}

export default function CustomTemplatesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
