"use client";

import { motion, type Variants } from "motion/react";

import {
    getVariants,
    type IconProps,
    IconWrapper,
    useAnimateIconContext,
} from "@/components/animate-ui/icons/icon";

type CodeXmlProps = IconProps<keyof typeof animations>;

const animations = {
    default: {
        // "<" flies in from the left edge to centre.
        left: {
            initial: { x: 0, opacity: 1 },
            animate: {
                x: [-6, 0],
                opacity: [0, 1],
                transition: { duration: 0.25, ease: "easeOut" },
            },
        },
        // ">" flies in from the right edge to centre.
        right: {
            initial: { x: 0, opacity: 1 },
            animate: {
                x: [6, 0],
                opacity: [0, 1],
                transition: { duration: 0.25, ease: "easeOut" },
            },
        },
        // "/" draws itself top → bottom once the brackets have arrived.
        slash: {
            initial: { pathLength: 1, opacity: 1 },
            animate: {
                pathLength: [0, 1],
                opacity: [0, 1],
                transition: { duration: 0.3, ease: "easeInOut", delay: 0.2 },
            },
        },
    } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: CodeXmlProps) {
    const { controls } = useAnimateIconContext();
    const variants = getVariants(animations);

    return (
        <motion.svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <motion.path
                d="m18 16 4-4-4-4"
                variants={variants.right}
                initial="initial"
                animate={controls}
            />
            <motion.path
                d="m6 8-4 4 4 4"
                variants={variants.left}
                initial="initial"
                animate={controls}
            />
            <motion.path
                d="m14.5 4-5 16"
                variants={variants.slash}
                initial="initial"
                animate={controls}
            />
        </motion.svg>
    );
}

function CodeXml(props: CodeXmlProps) {
    return <IconWrapper icon={IconComponent} {...props} />;
}

export {
    animations,
    CodeXml,
    CodeXml as CodeXmlIcon,
    type CodeXmlProps,
    type CodeXmlProps as CodeXmlIconProps,
};
