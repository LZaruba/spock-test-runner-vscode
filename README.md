# Spock Test Runner for VS Code

A VS Code extension that provides comprehensive test support for the Spock testing framework in Java projects. This extension integrates with VS Code's Test API to provide seamless test discovery, execution, and debugging capabilities for Spock tests.

**Version**: 0.0.9
**Author**: Lukas Zaruba

> **Inspiration**: This extension was inspired by [Daniel Micah's spock-test-runner](https://github.com/donnffd/spock-test-runner) but focuses exclusively on VS Code's Test API integration rather than CodeLens functionality.

## Features

- **Test Discovery**: Automatically discovers Spock test classes and methods in your workspace
- **Test Execution**: Run individual tests, test classes, or all tests through VS Code's Test Explorer
- **Debug Support**: Debug Spock tests with full breakpoint support and variable inspection
- **Build Tool Support**: Works with both Gradle and Maven projects
- **Real-time Updates**: Automatically updates test tree when files change
- **Error Reporting**: Detailed error messages with file locations for failed tests
- **Output Streaming**: Real-time test output in VS Code's Test Results panel

## Requirements

- VS Code 1.85.0 or higher
- Java 11 or higher
- Gradle or Maven build tool
- Spock framework in your project

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions view (Ctrl+Shift+X)
3. Search for "spock-test-runner-vscode"
4. Click Install

### From Source
1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press F5 to run the extension in a new Extension Development Host window

## Usage

### Test Discovery
The extension automatically discovers Spock tests in your workspace. Tests are organized in the Test Explorer panel under the following hierarchy:
- Workspace
  - File (.groovy files)
    - Test Class (classes extending Specification)
      - Test Methods (feature methods)

### Running Tests
You can run tests in several ways:
1. **Run All Tests**: Click the play button in the Test Explorer
2. **Run Specific Test**: Click the play button next to a specific test
3. **Run from Command Palette**: Use `Ctrl+Shift+P` and search for "spock-test-runner-vscode" commands
4. **Run from Context Menu**: Right-click on a test file and select "Run Spock Test"

### Debugging Tests
1. **Debug All Tests**: Click the debug button in the Test Explorer
2. **Debug Specific Test**: Click the debug button next to a specific test
3. **Set Breakpoints**: Click in the gutter next to line numbers in your test files
4. **Debug from Command Palette**: Use `Ctrl+Shift+P` and search for "spock-test-runner-vscode" commands

### Supported Test Patterns
The extension recognizes the following Spock test patterns:

```groovy
class MySpec extends Specification {
    
    def "should do something"() {
        given:
        // setup
        
        when:
        // action
        
        then:
        // verification
    }
    
    def "another test"() {
        expect:
        // simple assertion
    }
}
```

Specifications don't have to extend `Specification` directly. Classes extending it through one or more base classes are discovered as well, and the feature methods inherited from the base classes are listed (and run) under each inheriting specification:

```groovy
abstract class BaseSpec extends Specification {

    def "inherited test"() {
        expect:
        // runs as part of every spec extending BaseSpec
    }
}

class MySpec extends BaseSpec {

    def "own test"() {
        expect:
        // simple assertion
    }
}
```

Base classes are resolved across all `.groovy` files of the workspace. When a base class is not part of the workspace (e.g. `GebSpec` coming from a library), the class is recognized by its feature methods using Spock blocks (`given:`, `when:`, `then:`, `expect:`, `where:`, ...), with or without descriptions (e.g. `given: "a logged in user"`).

## Configuration

### Build Tool Detection
The extension automatically detects your build tool:
- **Gradle**: Looks for `build.gradle` file (preferred if both are present)
- **Maven**: Looks for `pom.xml` file

### Debug Configuration
The extension automatically creates debug configurations for your project. You can find them in `.vscode/launch.json`:

```json
{
    "type": "java",
    "name": "Debug Spock Tests (Groovy)",
    "request": "attach",
    "hostName": "localhost",
    "port": 5005,
    "projectName": "your-project-name",
    "sourcePaths": [
        "${workspaceFolder}",
        "${workspaceFolder}/src/test/groovy",
        "${workspaceFolder}/src/main/groovy"
    ]
}
```

## Sample Projects

A sample Gradle project with Spock tests is included in the `sample-projects/gradle-sample` directory. This project demonstrates:
- Basic arithmetic operations testing
- User service testing with CRUD operations
- Error handling and exception testing
- Multiple test scenarios

To test the extension:
1. Open the `sample-projects/gradle-sample` folder in VS Code
2. Install the Spock Test Runner extension
3. Open the Test Explorer to see discovered tests
4. Run or debug the tests

## Troubleshooting

### Tests Not Discovered
- Ensure your test classes extend `Specification` (directly or through base classes)
- Check that your Gradle build tool is properly configured
- Verify that Spock dependencies are included in your project
- Check the Output panel for "Spock Test Runner" logs

### Debug Not Working
- Ensure Java Extension Pack is installed
- Check that debug port 5005 is available
- Verify that your project has proper source paths configured
- Check the Output panel for debug-related error messages

### Build Tool Issues
- For Gradle: Ensure `gradlew` (wrapper) or `gradle` is available in your PATH
- For Maven: Ensure `mvnw` (wrapper) or `mvn` is available in your PATH
- Check that your build files are valid and properly configured
- If both `build.gradle` and `pom.xml` exist, Gradle will be used (configure one build tool per project)

## Development

### Building from Source
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Run tests
npm test
```

### Release Instructions

Releases are made by the manual [Release workflow](.github/workflows/release.yml). Only the repository owner can run it.

1. Go to **Actions → Release → Run workflow**, keep the branch on `master` and pick the bump (`patch`, `minor`, `major`), or type an exact version.
2. The workflow:
   - bumps `version` in `package.json` and `package-lock.json` and the **Version** line in this README
   - adds a `## [x.y.z] - YYYY-MM-DD` section to `CHANGELOG.md` listing the pull requests merged since the last release, sorted into Added / Changed / Fixed by their titles (`feat…`/`add…` → Added, `fix…` → Fixed, everything else → Changed) or labels (`enhancement`, `bug`), and thanking outside contributors
   - lints and builds `spock-test-runner-vscode-x.y.z.vsix`
   - commits `Release vx.y.z` to `master` and pushes it with the tag `vx.y.z`
   - creates a GitHub Release with the VSIX attached and the new changelog section as notes
   - publishes the VSIX to the VS Code Marketplace and Open VSX

If a publish step fails after the release commit was pushed, run the workflow again with the bump `none`: it rebuilds the current version from its tag and publishes it again, skipping a registry that already has it.

#### One-time setup

- **`master` protection.** The workflow pushes its release commit straight to `master`. Create an SSH key pair (`ssh-keygen -t ed25519 -f release-key -N ""`), add `release-key.pub` under **Settings → Deploy keys** with **Allow write access**, and store `release-key` as the repository secret `RELEASE_DEPLOY_KEY`. In the ruleset protecting `master` (**Settings → Rules → Rulesets**), add **Deploy keys** to the bypass list.
- **Open VSX** uses [trusted publishing](https://github.com/eclipse-openvsx/openvsx/wiki/Trusted-Publishing), so no token is stored. On [open-vsx.org](https://open-vsx.org) go to **Settings → Trusted Publishers**, select the `LZaruba` namespace, choose **GitHub Actions** and enter owner `LZaruba`, repository `spock-test-runner-vscode`, workflow `release.yml`, environment `release`.
- **VS Code Marketplace** signs in with Microsoft Entra ID (personal access tokens for the Marketplace stop working on 2026-12-01):
  1. In the [Azure portal](https://portal.azure.com) create a **user-assigned managed identity** (an App Registration does not work for publishing).
  2. In the identity's **Federated credentials**, add a credential for **GitHub Actions deploying Azure resources**: organization `LZaruba`, repository `spock-test-runner-vscode`, entity type **Environment**, environment `release`.
  3. Store the identity's **Client ID** and **Tenant ID** as the repository secrets `AZURE_CLIENT_ID` and `AZURE_TENANT_ID`.
  4. Find the identity's Marketplace ID: signed in as the identity (e.g. a one-off workflow step after `azure/login`), run `az rest -u https://app.vssps.visualstudio.com/_apis/profile/profiles/me --resource 499b84ac-1321-427f-aa17-267ca6975798` and copy the `id` from the response.
  5. On the [Marketplace publisher page](https://marketplace.visualstudio.com/manage/publishers/LZaruba) open **Members**, add that `id` and give it the **Contributor** role.

  Until then, a [personal access token](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token) (organization **All accessible organizations**, scope **Marketplace → Manage**) stored as the secret `VSCE_PAT` works as well. The Marketplace step is skipped with a warning when neither `AZURE_CLIENT_ID` nor `VSCE_PAT` is set. The Open VSX step fails until the trusted publisher is registered.

#### Releasing by hand

The workflow runs the same commands you would run locally:
```bash
npm run package                       # builds spock-test-runner-vscode-x.y.z.vsix
git tag vx.y.z && git push origin vx.y.z
npx vsce publish --packagePath spock-test-runner-vscode-x.y.z.vsix -p <marketplace-token>
npx ovsx publish spock-test-runner-vscode-x.y.z.vsix -p <open-vsx-token>
```

### Project Structure
```
├── src/
│   ├── extension.ts          # Main extension entry point
│   └── testController.ts     # Test controller implementation
├── sample-project/           # Sample Gradle project
├── .vscode/                  # VS Code configuration
├── package.json              # Extension manifest
└── README.md                 # This file
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Spock Framework](https://spockframework.org/) - The testing framework this extension supports
- [VS Code Test API](https://code.visualstudio.com/api/extension-guides/testing) - The testing API this extension uses
- [Gradle](https://gradle.org/) - Build tool supported by this extension
- [Maven](https://maven.apache.org/) - Build tool supported by this extension
