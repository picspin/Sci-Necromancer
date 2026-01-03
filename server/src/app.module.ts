import { Module } from '@nestjs/common';
import { FileModule } from './file/file.module';

/**
 * Root Application Module
 * Organizes backend functionality into feature modules
 */
@Module({
  imports: [FileModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
