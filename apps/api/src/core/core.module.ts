import { Module } from '@nestjs/common';
import { BusinessExistsGuard } from '../common/business-exists.guard';
import { BusinessController } from './business/business.controller';
import { BusinessService } from './business/business.service';
import { BusinessTypeController } from './business-type/business-type.controller';
import { BusinessTypeService } from './business-type/business-type.service';
import { LocationController } from './location/location.controller';
import { LocationService } from './location/location.service';
import { SettingsController } from './settings/settings.controller';
import { AdminSettingsController } from './settings/admin-settings.controller';
import { SettingsService } from './settings/settings.service';
import { SettingsRegistry } from './settings/settings.registry';
import { AuditController } from './audit/audit.controller';
import { AdminAuditController } from './audit/admin-audit.controller';
import { AuditService } from './audit/audit.service';
import { NumberingController } from './numbering/numbering.controller';
import { NumberingService } from './numbering/numbering.service';
import { AlertRuleController } from './alerts/alert-rule.controller';
import { AlertRuleService } from './alerts/alert-rule.service';
import { AlertDispatcher } from './alerts/alert-dispatcher';
import { NotificationService } from './notifications/notification.service';
import { NotificationController } from './notifications/notification.controller';

/**
 * Nexus Core — Phase 2 foundation + Phase 6 Configuration Center + Phase 11 Alerts/Audit.
 * Vertical-neutral: Business Workspace, Locations, typed Configuration
 * (with Location>Business precedence), hash-chained Activity History,
 * gapless number allocation, alert-rule registry, in-app notifications.
 */
@Module({
  controllers: [
    BusinessController,
    BusinessTypeController,
    LocationController,
    SettingsController,
    AdminSettingsController,
    AuditController,
    AdminAuditController,
    NumberingController,
    AlertRuleController,
    NotificationController,
  ],
  providers: [
    BusinessService,
    BusinessTypeService,
    LocationService,
    SettingsService,
    SettingsRegistry,
    AuditService,
    NumberingService,
    BusinessExistsGuard,
    AlertRuleService,
    AlertDispatcher,
    NotificationService,
  ],
  exports: [
    AuditService,
    SettingsService,
    SettingsRegistry,
    NumberingService,
    LocationService,
    BusinessService,
    AlertRuleService,
    AlertDispatcher,
  ],
})
export class CoreModule {}
