
import {throwError as observableThrowError, Observable} from 'rxjs';

import {catchError, map} from 'rxjs/operators';
import {Injectable, Inject} from '@angular/core';
import {HttpClient, HttpParams, HttpHeaders, HttpResponse} from '@angular/common/http';
import {OnlineResourceModel} from '../../model/data/onlineresource.model';
import {CsMapObject} from '../cesium-map/cs-map-object';
import {UtilitiesService} from '../../utility/utilities.service';
import {Constants} from '../../utility/constants.service';


@Injectable()
export class QueryWMSService {

  constructor(private http: HttpClient, private csMapObject: CsMapObject, @Inject('env') private env) {
  }


  /**
   * Create WMS parameters using small local tiles
   * @param layerName name of layer
   * @param clickCoord clicked on map coordinates
   */
  private useLocalTiles(layerName: string, clickCoord: number[]): [number, number, any, number] {
    const mapObj = this.csMapObject.getMap();
    const view = mapObj.getView();
    const viewResolution = view.getResolution();
    const layers = this.csMapObject.getLayers();

    // Look for our layer
    for (const l in layers) {
      if (layers[l][0].onlineResource.name === layerName) {
        // Fetch image data source
        const src =  layers[l][0].getSource();
        let tileGrid = src.getTileGrid();
        if (!tileGrid) {
          const projectionObj = view.getProjection(Constants.MAP_PROJ);
          tileGrid = src.getTileGridForProjection(projectionObj);
        }
        // Fetch tile coordinates i.e. [zoom level, x-th tile in the x-direction, y-th tile in the y-direction]
        const tileCoord = tileGrid.getTileCoordForCoordAndResolution(clickCoord, viewResolution);
        // Fetch tile resolution, e.g. a number proportional to the number of metres the tile covers on map 
        const tileResolution: number = tileGrid.getResolution(tileCoord[0]);
        // Fetch tile bounding box as map coordinate
        const tileExtent = tileGrid.getTileCoordExtent(tileCoord);
        // Fetch tile size in pixels
        const tileSize: number = tileGrid.getTileSize(tileCoord[0]);
        // Calculate x,y coords within the tile (in pixels)
        const x = Math.floor((clickCoord[0] - tileExtent[0]) / tileResolution);
        const y = Math.floor((tileExtent[3] - clickCoord[1]) / tileResolution);
        return [x, y, tileExtent, tileSize];
      }
    }
    return [undefined, undefined, undefined, undefined]
  }

  public getFilter(lon: number, lat: number, extraFilter: string): string {
    const distPerPixel = this.csMapObject.getDistPerPixel();
    const step = distPerPixel * 20; // 10pixel distance by degree = 10*1.1km.

    const ogcFilter = '<ogc:Filter xmlns:ogc=\"http://www.opengis.net/ogc\" xmlns:gsmlp=\"http://xmlns.geosciml.org/geosciml-portrayal/4.0\" xmlns:gml=\"http://www.opengis.net/gml\"><ogc:And><ogc:BBOX><ogc:PropertyName>gsmlp:shape</ogc:PropertyName><gml:Box srsName=\"urn:x-ogc:def:crs:EPSG:4326\">' + 
    '<gml:coord><gml:X>' + (lon - step) + '</gml:X><gml:Y>' + (lat - step) + '</gml:Y></gml:coord>' + 
    '<gml:coord><gml:X>' + (lon + step) + '</gml:X><gml:Y>' + (lat + step) + '</gml:Y></gml:coord>' + 
    '</gml:Box></ogc:BBOX>' + extraFilter + '</ogc:And></ogc:Filter>';
    return ogcFilter;
  }

  /**
  * A get feature info request via proxy
  * @param onlineresource the WMS online resource
  * @param sldBody style layer descriptor
  * @param pixel [x,y] pixel coordinates of clicked on point
  * @param clickCoord [lat,long] map coordinates of clicked on point  
  * @return Observable the observable from the http request
   */
  /*
   public wfsGetFeature(serviceUrl: string, typeName: string, lon: number, lat: number): Observable<any> {
    let formdata = new HttpParams();
    formdata = formdata.append('SERVICE', 'WFS');
    formdata = formdata.append('request', 'GetFeature');
    formdata = formdata.append('typeName', typeName);
    formdata = formdata.append('outputFormat', 'GML3');
    // formdata = formdata.append('maxFeatures', '10');
    formdata = formdata.append('version', '1.0.0');
    formdata = formdata.append('FILTER', this.getFilter(lon, lat));
    return this.http.get(serviceUrl, formdata.toString(), {
      headers: new HttpHeaders()
        .set('Content-Type', 'application/x-www-form-urlencoded'),
      responseType: 'text'
    }).pipe(map(response => {
      return response;
    }), catchError(
    (error: HttpResponse<any>) => {
          return observableThrowError(error);
        }
      ), );


  }*/
  public wfsGetFeature(onlineResource: OnlineResourceModel, lon: number, lat: number, extraFilter: string): Observable<any> {
    let formdata = new HttpParams();
    const serviceUrl = UtilitiesService.rmParamURL(onlineResource.url);
    const typeName = onlineResource.name;
    formdata = formdata.append('SERVICE', 'WFS');
    formdata = formdata.append('request', 'GetFeature');
    formdata = formdata.append('typeName', typeName);
    formdata = formdata.append('outputFormat', 'GML3');
    const version = '1.1.0';
    // if ( version === '2.0.0' ) {
    //   formdata = formdata.append('count', '10');
    // } else
    {
      formdata = formdata.append('maxFeatures', '10');
    }
    formdata = formdata.append('version', version);
    formdata = formdata.append('FILTER', this.getFilter(lon, lat, extraFilter));
    return this.http.get(serviceUrl, {
      params: formdata,
      responseType: 'text'
    }).pipe(map(response => {
      return response;
    }), catchError(
    (error: HttpResponse<any>) => {
          return observableThrowError(error);
        }
      ), );


  }
  /**
  * A get feature info request via proxy
  * @param onlineresource the WMS online resource
  * @param sldBody style layer descriptor
  * @param pixel [x,y] pixel coordinates of clicked on point
  * @param clickCoord [lat,long] map coordinates of clicked on point  
  * @return Observable the observable from the http request
   */
  public getFeatureInfo(onlineResource: OnlineResourceModel, sldBody: string, pixel: string[], clickCoord: any[]): Observable<any> {
    let formdata = new HttpParams();
    formdata = formdata.append('serviceUrl', UtilitiesService.rmParamURL(onlineResource.url));
    formdata = formdata.append('lat', clickCoord[1]);
    formdata = formdata.append('lng', clickCoord[0]);
    formdata = formdata.append('QUERY_LAYERS', onlineResource.name);

    // GSKY has an image WIDTH/HEIGHT size limit, so use the local WMS tile as the image
    // in the WMS 'GetFeatureInfo' request 
    if (UtilitiesService.isGSKY(onlineResource)) {
      let [x, y, tileExtent, tileSize] = this.useLocalTiles(onlineResource.name, clickCoord);
      if (!tileSize) {
        return observableThrowError("Cannot locate layer");
      }
      formdata = formdata.append('x', x.toString());
      formdata = formdata.append('y', y.toString());
      formdata = formdata.append('WIDTH', tileSize.toString());
      formdata = formdata.append('HEIGHT', tileSize.toString());
      formdata = formdata.append('BBOX', tileExtent);

    } else {
      // Uses the whole screen as the image in the WMS 'GetFeatureInfo' request
      const bounds = this.csMapObject.getMapViewBounds();
      const bbox = [bounds[0].toString(), bounds[1].toString(), bounds[2].toString(), bounds[3].toString()].toString();
      const size = this.csMapObject.getViewSize();
      formdata = formdata.append('x', pixel[0]);
      formdata = formdata.append('y', pixel[1]);
      formdata = formdata.append('WIDTH', size[0]);
      formdata = formdata.append('HEIGHT', size[1]);
      formdata = formdata.append('BBOX', bbox);
    }
    formdata = formdata.append('version', onlineResource.version);

    if (sldBody) {
      formdata = formdata.append('SLD_BODY', sldBody);
      formdata = formdata.append('postMethod', 'true');
    } else {
      formdata = formdata.append('SLD_BODY', '');
    }

    if (onlineResource.name.indexOf('ProvinceFullExtent') >= 0) {
      formdata = formdata.append('INFO_FORMAT', 'application/vnd.ogc.gml');
    } else {
      formdata = formdata.append('INFO_FORMAT', 'application/vnd.ogc.gml/3.1.1');
    }

    if (UtilitiesService.isArcGIS(onlineResource)) {
      formdata = formdata.set('INFO_FORMAT', 'text/xml');
      formdata = formdata.set('SLD_BODY', '');
      formdata = formdata.set('postMethod', 'false');
    }

    // GSKY services always return JSON responses
    if (UtilitiesService.isGSKY(onlineResource)) {
      formdata = formdata.set('INFO_FORMAT', 'application/json');
    }

    if (onlineResource.description.indexOf('EMAG2 - Total Magnetic Intensity') >= 0) {
      formdata = formdata.set('INFO_FORMAT', 'text/xml');
    }
    
    if (onlineResource.description.indexOf('Onshore Seismic Surveys') >= 0) {
      formdata = formdata.set('INFO_FORMAT', 'text/xml');
    }  

    return this.http.post(this.env.portalBaseUrl + 'wmsMarkerPopup.do', formdata.toString(), {
      headers: new HttpHeaders()
        .set('Content-Type', 'application/x-www-form-urlencoded'),
      responseType: 'text'
    }).pipe(map(response => {
      return response;
    }), catchError(
    (error: HttpResponse<any>) => {
          return observableThrowError(error);
        }
      ), );


  }
}
