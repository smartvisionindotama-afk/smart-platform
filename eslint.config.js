import smartEslint from "@smart/config/eslint";


export default [
    ...smartEslint,
    {
        ignores: [
            "**/node_modules/**",
            "**/dist/**",
            "**/coverage/**"
        ]
    }
];
