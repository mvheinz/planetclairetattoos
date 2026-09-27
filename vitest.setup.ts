// Gemeinsames Setup für Unit- und Int-Tests (ARCHITEKTUR §7.2).
import 'dotenv/config'

import { installNetworkGuard } from './tests/setup/network-guard'

installNetworkGuard()
