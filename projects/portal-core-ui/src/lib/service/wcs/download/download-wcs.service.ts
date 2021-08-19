
import {throwError as observableThrowError,  Observable } from 'rxjs';
import {Injectable, Inject} from '@angular/core';
import {timeoutWith, map, catchError} from 'rxjs/operators';
import {HttpClient, HttpParams, HttpHeaders, HttpResponse} from '@angular/common/http';

import { Bbox } from '../../../model/data/bbox.model';
import { LayerModel } from '../../../model/data/layer.model';
import { ResourceType } from '../../../utility/constants.service';
import { LayerHandlerService } from '../../cswrecords/layer-handler.service';



import { UtilitiesService } from '../../../utility/utilities.service';


/**
 * Use Cesium to dowload map data.
 */
@Injectable()
export class DownloadWcsService {



  constructor(private layerHandlerService: LayerHandlerService, private http: HttpClient, @Inject('env') private env) {

  }

  /**
   * Download the layer as a zip file
   * @param layer the layer to download
   * @param bbox the bounding box of the area to download
   * @param inputCrs coordinate reference system of bounding box
   * @param downloadformat requests a download in a certain format
   * @param outputCrs coord reference system for the download
   * @param timeRange range of times if applicable to layers
   * @return observable containing the download or error
   */
  public download(layer: LayerModel, bbox: Bbox, inputCrs: string, downloadFormat: string, outputCrs: string, timePositions: string[]): Observable<any> {
    try {
      const ftpResources = this.layerHandlerService.getOnlineResources(layer, ResourceType.FTP);
      const ftpURL = (ftpResources.length > 0) ? ftpResources[0]['url'] : '';
      const wcsResources = this.layerHandlerService.getWCSResource(layer);

      let httpParams = new HttpParams();
      httpParams = httpParams.set('layerName', wcsResources[0].name);
      httpParams = httpParams.set('serviceUrl', UtilitiesService.rmParamURL(wcsResources[0].url));
      httpParams = httpParams.set('usingBboxConstraint', 'on');
      httpParams = httpParams.set('northBoundLatitude', bbox.northBoundLatitude.toString());
      httpParams = httpParams.set('southBoundLatitude', bbox.southBoundLatitude.toString());
      httpParams = httpParams.set('eastBoundLongitude', bbox.eastBoundLongitude.toString());
      httpParams = httpParams.set('westBoundLongitude', bbox.westBoundLongitude.toString());

      httpParams = httpParams.set('outputDimensionsType', 'widthHeight');
      
      // User can select any rectangular shape on screen.
      // We must make sure that the downloaded image has the same shape.
      // Calculate aspect ratio = height / width
      // NB: Assumes bbox does not cross longitude boundary
      const aspectRatio = Math.abs(bbox.southBoundLatitude - bbox.northBoundLatitude)/Math.abs(bbox.eastBoundLongitude - bbox.westBoundLongitude);
      
      // Downloaded image always has longest side of 'MAX_SIDE' pixels
      const MAX_SIDE = 4096;

      // If width < height
      if (aspectRatio < 1.0) {
        // Set width of image to be 'MAX_SIDE'
        httpParams = httpParams.set('outputWidth', MAX_SIDE.toString());
        // Set height of image to be less than 'MAX_SIDE'
        httpParams = httpParams.set('outputHeight', Math.floor(MAX_SIDE*aspectRatio).toString());

      // If width >= height
      } else {
        // Set width of image to be less than 'MAX_SIDE'
        httpParams = httpParams.set('outputWidth', Math.floor(MAX_SIDE/aspectRatio).toString());
        // Set height of image to be 'MAX_SIDE'
        httpParams = httpParams.set('outputHeight', MAX_SIDE.toString());
      }
      httpParams = httpParams.set('inputCrs', inputCrs);
      httpParams = httpParams.set('downloadFormat', downloadFormat);
      httpParams = httpParams.set('outputCrs', outputCrs);
      httpParams = httpParams.set('ftpURL', ftpURL);

      if (timePositions && timePositions.length > 0) {
        httpParams = httpParams.set('timePosition', timePositions.join());
      }

      return this.http.get(this.env.portalBaseUrl + 'downloadWCSAsZip.do', {
        params: httpParams,
        responseType: 'blob'
      }).pipe(timeoutWith(360000, observableThrowError(new Error('The request has timed out after 5 minutes'))),
        map((response) => { // download file
          return response;
	  }), catchError((error: HttpResponse<any>) => {
          return observableThrowError(error);
        }), );
    } catch (e) {
      return observableThrowError(e);
    }

  }

  /**
   *  Describe coverage
   *  @param serviceUrl URL of the WCS
   *  @param coverageName name of coverage
   *  @return observable containing the describe coverage response or error
   */
   public describeCoverage(serviceUrl: string, coverageName: string): Observable<any> {
    let httpParams = new HttpParams();
    httpParams = httpParams.append('serviceUrl', serviceUrl);
    httpParams = httpParams.append('coverageName', coverageName);

    return this.http.post(this.env.portalBaseUrl + 'describeCoverage.do', httpParams.toString(), {
      headers: new HttpHeaders().set('Content-Type', 'application/x-www-form-urlencoded'),
      responseType: 'json'
    }).pipe(map(response => {
      if (response['success'] === true) {
        return response['data'][0];
      } else {
        return observableThrowError(response['msg']);
      }
    }), catchError(
    (error: HttpResponse<any>) => {
        return observableThrowError(error);
      }
      ), );
  }
}
