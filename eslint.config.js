import smartEslint from "@smart/config/eslint";


export default [
    ...smartEslint,
    {
        ignores: [
            "**/node_modules/**",
            "**/dist/**",
            "**/coverage/**",
            "apps/smartvindo/**",
            "apps/desa-insight/**",
            "apps/eprofit/**",
            "apps/santripintar/**",
            "apps/sitampan/**",
            "platform/**"
        ]
    }
];
