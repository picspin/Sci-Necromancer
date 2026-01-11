import { Module } from '@nestjs/common';
import { FileModule } from './file/file.module';
import { ImageModule } from './image/image.module';

/**
 * Root Application Module
 * Organizes backend functionality into feature modules
 */
@Module({
  imports: [FileModule, ImageModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
